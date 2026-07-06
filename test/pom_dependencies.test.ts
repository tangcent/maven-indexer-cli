import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { createMavenArtifact } from './helpers.js';

/**
 * Tests POM dependency graph: getDependencies and findDependents.
 * Covers T6B.8-T6B.10.
 */

const pomWithDeps = (groupId: string, artifactId: string, version: string, deps: { groupId: string; artifactId: string; version?: string; scope?: string }[]) => {
  const depXml = deps.map(d =>
    `    <dependency>
      <groupId>${d.groupId}</groupId>
      <artifactId>${d.artifactId}</artifactId>
      ${d.version ? `<version>${d.version}</version>` : ''}
      ${d.scope ? `<scope>${d.scope}</scope>` : ''}
    </dependency>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <groupId>${groupId}</groupId>
  <artifactId>${artifactId}</artifactId>
  <version>${version}</version>
  <dependencies>
${depXml}
  </dependencies>
</project>`;
};

describe('POM dependency graph', () => {
  let tmpDir: string;
  let repoDir: string;
  let dbPath: string;
  let indexer: any;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-cli-pomdep-'));
    repoDir = path.join(tmpDir, 'repo');
    dbPath = path.join(tmpDir, 'test.sqlite');
    fs.mkdirSync(repoDir, { recursive: true });

    // Artifact A depends on B
    createMavenArtifact(repoDir, {
      groupId: 'com.example',
      artifactId: 'artifact-a',
      version: '1.0.0',
      classes: [{ name: 'com.example.ArtifactA' }],
      pomContent: pomWithDeps('com.example', 'artifact-a', '1.0.0', [
        { groupId: 'com.example', artifactId: 'artifact-b', version: '2.0.0', scope: 'compile' },
      ]),
    });

    // Artifact B (the dependency)
    createMavenArtifact(repoDir, {
      groupId: 'com.example',
      artifactId: 'artifact-b',
      version: '2.0.0',
      classes: [{ name: 'com.example.ArtifactB' }],
    });

    // Artifact C depends on A
    createMavenArtifact(repoDir, {
      groupId: 'org.other',
      artifactId: 'artifact-c',
      version: '3.0.0',
      classes: [{ name: 'org.other.ArtifactC' }],
      pomContent: pomWithDeps('org.other', 'artifact-c', '3.0.0', [
        { groupId: 'com.example', artifactId: 'artifact-a', version: '1.0.0', scope: 'compile' },
      ]),
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

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getDependencies', () => {
    it('returns the declared dependencies of an artifact', () => {
      const deps = indexer.getDependencies('com.example', 'artifact-a', '1.0.0');
      expect(deps).toHaveLength(1);
      expect(deps[0].groupId).toBe('com.example');
      expect(deps[0].artifactId).toBe('artifact-b');
      expect(deps[0].version).toBe('2.0.0');
      expect(deps[0].scope).toBe('compile');
      expect(deps[0].optional).toBe(false);
    });

    it('returns empty array for an artifact with no dependencies', () => {
      const deps = indexer.getDependencies('com.example', 'artifact-b', '2.0.0');
      expect(deps).toEqual([]);
    });

    it('returns empty array for an unknown artifact', () => {
      const deps = indexer.getDependencies('com.unknown', 'missing', '9.9.9');
      expect(deps).toEqual([]);
    });
  });

  describe('findDependents', () => {
    it('returns artifacts that declare a dependency on the given coordinate', () => {
      // Dependents of A: C depends on A
      const dependents = indexer.findDependents('com.example', 'artifact-a');
      expect(dependents).toHaveLength(1);
      expect(dependents[0].groupId).toBe('org.other');
      expect(dependents[0].artifactId).toBe('artifact-c');
      expect(dependents[0].version).toBe('3.0.0');
    });

    it('returns multiple dependents when applicable', () => {
      // Dependents of B: A depends on B
      const dependents = indexer.findDependents('com.example', 'artifact-b');
      expect(dependents).toHaveLength(1);
      expect(dependents[0].groupId).toBe('com.example');
      expect(dependents[0].artifactId).toBe('artifact-a');
      expect(dependents[0].version).toBe('1.0.0');
    });

    it('returns empty array for an artifact with no dependents', () => {
      const dependents = indexer.findDependents('org.other', 'artifact-c');
      expect(dependents).toEqual([]);
    });
  });
});
