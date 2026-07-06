import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { createMavenArtifact, cleanupSingletons } from './helpers.js';

/**
 * Tests the new query methods on Indexer:
 * getArtifactInfo, getStats, listClasses, getResource.
 * Covers T6A.1-T6A.5.
 */

describe('new query methods on Indexer', () => {
  let tmpDir: string;
  let repoDir: string;
  let dbPath: string;
  let indexer: any;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-cli-newcmd-'));
    repoDir = path.join(tmpDir, 'repo');
    dbPath = path.join(tmpDir, 'test.sqlite');
    fs.mkdirSync(repoDir, { recursive: true });

    createMavenArtifact(repoDir, {
      groupId: 'com.example',
      artifactId: 'demo',
      version: '1.0.0',
      classes: [{ name: 'com.example.Hello' }],
      resources: [
        { path: 'META-INF/services/com.example.Hello', content: 'com.example.Hello' },
      ],
    });

    const { DB } = await import('../src/core/db/index.js');
    const { Config } = await import('../src/core/config.js');
    const { Indexer } = await import('../src/core/indexer.js');

    DB.reset();
    Config.reset();
    (Indexer as any).instance = undefined;

    DB.getInstance(dbPath);
    const config = await Config.getInstance();
    config.localRepository = repoDir;
    config.gradleRepository = '';

    indexer = Indexer.getInstance();
    await indexer.index();
  });

  afterEach(async () => {
    await cleanupSingletons();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getArtifactInfo', () => {
    it('returns artifact info with class count, resource count, and jar exists flag', () => {
      const info = indexer.getArtifactInfo('com.example', 'demo', '1.0.0');
      expect(info).toHaveLength(1);
      const entry = info[0];
      expect(entry.artifact.groupId).toBe('com.example');
      expect(entry.artifact.artifactId).toBe('demo');
      expect(entry.artifact.version).toBe('1.0.0');
      expect(entry.classCount).toBe(1);
      expect(entry.resourceCount).toBe(1);
      expect(entry.mainJarExists).toBe(true);
    });

    it('returns all versions when version is omitted', () => {
      // Only one version in fixture
      const info = indexer.getArtifactInfo('com.example', 'demo');
      expect(info).toHaveLength(1);
      expect(info[0].artifact.version).toBe('1.0.0');
    });

    it('returns empty array for unknown artifact', () => {
      const info = indexer.getArtifactInfo('com.unknown', 'missing', '9.9.9');
      expect(info).toEqual([]);
    });

    it('reports mainJarExists=false when JAR is deleted', () => {
      const jarPath = path.join(repoDir, 'com', 'example', 'demo', '1.0.0', 'demo-1.0.0.jar');
      fs.unlinkSync(jarPath);

      const info = indexer.getArtifactInfo('com.example', 'demo', '1.0.0');
      expect(info[0].mainJarExists).toBe(false);
    });
  });

  describe('getStats', () => {
    it('returns aggregate statistics about the index', () => {
      const stats = indexer.getStats();
      expect(stats.artifactCount).toBe(1);
      expect(stats.classCount).toBe(1);
      expect(stats.resourceCount).toBe(1);
      expect(stats.dbPath).toBe(dbPath);
      expect(stats.dbSizeBytes).toBeGreaterThan(0);
      expect(stats.lastIndexedAt).not.toBeNull();
    });
  });

  describe('listClasses', () => {
    it('returns distinct class names for the given artifact coordinate', () => {
      const classes = indexer.listClasses('com.example', 'demo', '1.0.0');
      expect(classes).toHaveLength(1);
      expect(classes).toContain('com.example.Hello');
    });

    it('returns empty array for unknown artifact', () => {
      const classes = indexer.listClasses('com.unknown', 'missing', '9.9.9');
      expect(classes).toEqual([]);
    });
  });

  describe('getResource', () => {
    it('returns resource content by artifact coordinate and path', () => {
      const res = indexer.getResource(
        'com.example', 'demo', '1.0.0', 'META-INF/services/com.example.Hello',
      );
      expect(res).not.toBeNull();
      expect(res!.path).toBe('META-INF/services/com.example.Hello');
      expect(res!.content).toBe('com.example.Hello');
      expect(res!.type).toBe('services');
    });

    it('returns null for a non-existent resource path', () => {
      const res = indexer.getResource('com.example', 'demo', '1.0.0', 'nonexistent.txt');
      expect(res).toBeNull();
    });

    it('returns null for an unknown artifact', () => {
      const res = indexer.getResource('com.unknown', 'missing', '9.9.9', 'any.txt');
      expect(res).toBeNull();
    });
  });
});
