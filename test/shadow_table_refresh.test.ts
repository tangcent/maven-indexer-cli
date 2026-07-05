import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { createMavenArtifact } from './helpers.js';

/**
 * Tests that shadow-table refresh preserves the old index on failure.
 * Covers T4.1, T4.2, T4.5, T4.16.
 */

function openDb(dbPath: string): Database.Database {
  return new Database(dbPath);
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
  ).get(name) as { name: string } | undefined;
  return row !== undefined;
}

describe('shadow-table refresh preserves old index on failure', () => {
  let tmpDir: string;
  let repoDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-cli-shadow-'));
    repoDir = path.join(tmpDir, 'repo');
    dbPath = path.join(tmpDir, 'test.sqlite');
    fs.mkdirSync(repoDir, { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('keeps old classes searchable when refresh fails mid-build', async () => {
    // 1. Create fixture with valid JARs containing .class files
    createMavenArtifact(repoDir, {
      groupId: 'com.example',
      artifactId: 'demo',
      version: '1.0.0',
      classes: [{ name: 'com.example.Foo' }],
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

    const indexer = Indexer.getInstance();

    // 2. Index normally
    await indexer.index();

    // 3. Verify classes are searchable
    let results = indexer.searchClass('Foo');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const classNames = results.map(r => r.className);
    expect(classNames).toContain('com.example.Foo');

    // 4. Spy on index() to throw during the shadow refresh
    vi.spyOn(indexer, 'index').mockRejectedValueOnce(new Error('forced failure'));

    // 5. Call refresh() — it should throw
    await expect(indexer.refresh()).rejects.toThrow('forced failure');

    // 6. Verify old classes are STILL searchable (old index preserved)
    results = indexer.searchClass('Foo');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.map(r => r.className)).toContain('com.example.Foo');

    // 7. Verify no _new shadow tables remain in the DB
    const db = openDb(dbPath);
    for (const t of [
      'classes_fts_new',
      'inheritance_new',
      'resources_new',
      'resource_classes_new',
      'methods_new',
      'dependencies_new',
    ]) {
      expect(tableExists(db, t)).toBe(false);
    }
    db.close();
  });

  it('atomically swaps to the new index on successful refresh', async () => {
    // Start with one artifact
    createMavenArtifact(repoDir, {
      groupId: 'com.example',
      artifactId: 'demo',
      version: '1.0.0',
      classes: [{ name: 'com.example.OldClass' }],
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

    const indexer = Indexer.getInstance();
    await indexer.index();

    expect(indexer.searchClass('OldClass').map(r => r.className)).toContain('com.example.OldClass');

    // Replace fixture: remove old class, add new class
    fs.rmSync(path.join(repoDir, 'com', 'example', 'demo', '1.0.0', 'demo-1.0.0.jar'));
    createMavenArtifact(repoDir, {
      groupId: 'com.example',
      artifactId: 'demo',
      version: '1.0.0',
      classes: [{ name: 'com.example.NewClass' }],
    });

    // Successful refresh should swap to the new index
    await indexer.refresh();

    const newResults = indexer.searchClass('NewClass');
    expect(newResults.map(r => r.className)).toContain('com.example.NewClass');

    // Old class should no longer be in the new index
    const oldResults = indexer.searchClass('OldClass');
    expect(oldResults.map(r => r.className)).not.toContain('com.example.OldClass');

    // No _new tables remain after successful swap
    const db = openDb(dbPath);
    expect(tableExists(db, 'classes_fts_new')).toBe(false);
    db.close();
  });
});
