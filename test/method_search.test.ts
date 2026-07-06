import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { createMavenArtifact } from './helpers.js';

/**
 * Tests method search (gated by INDEX_METHODS=1 env var).
 * Covers T6B.1-T6B.4.
 */

describe('method search', () => {
  let tmpDir: string;
  let repoDir: string;
  let dbPath: string;
  let indexer: any;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-cli-methods-'));
    repoDir = path.join(tmpDir, 'repo');
    dbPath = path.join(tmpDir, 'test.sqlite');
    fs.mkdirSync(repoDir, { recursive: true });

    // Enable method indexing
    process.env.INDEX_METHODS = '1';

    createMavenArtifact(repoDir, {
      groupId: 'com.example',
      artifactId: 'demo',
      version: '1.0.0',
      classes: [{
        name: 'com.example.Service',
        methods: ['doSomething', 'getValue', 'setValue'],
      }],
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
    delete process.env.INDEX_METHODS;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds methods by substring match', () => {
    const results = indexer.searchMethods('doSomething');
    expect(results).toHaveLength(1);
    expect(results[0].methodName).toBe('doSomething');
    expect(results[0].className).toBe('com.example.Service');
    expect(results[0].artifacts).toHaveLength(1);
    expect(results[0].artifacts[0].groupId).toBe('com.example');
    expect(results[0].artifacts[0].artifactId).toBe('demo');
  });

  it('finds methods by exact match with exact flag', () => {
    const results = indexer.searchMethods('doSomething', { exact: true });
    expect(results).toHaveLength(1);
    expect(results[0].methodName).toBe('doSomething');
  });

  it('substring match finds partial method names', () => {
    // "Value" should match both getValue and setValue
    const results = indexer.searchMethods('Value');
    const names = results.map((r: any) => r.methodName).sort();
    expect(names).toEqual(['getValue', 'setValue']);
  });

  it('returns empty array for non-existent method', () => {
    const results = indexer.searchMethods('nonexistent');
    expect(results).toEqual([]);
  });

  it('exact match does not find substrings', () => {
    // "Value" with exact should not match "getValue" or "setValue"
    const results = indexer.searchMethods('Value', { exact: true });
    expect(results).toEqual([]);
  });
});
