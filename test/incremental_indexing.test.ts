import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { createMavenArtifact } from './helpers.js';

/**
 * Tests incremental indexing logic: mtime-based skipping, full-scan interval,
 * and pruning of artifacts whose JARs have been deleted.
 * Covers T6B.6.
 */

function openDb(dbPath: string): Database.Database {
  return new Database(dbPath);
}

describe('incremental indexing', () => {
  let tmpDir: string;
  let repoDir: string;
  let dbPath: string;
  let indexer: any;
  let DB: any;
  let Indexer: any;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-cli-incr-'));
    repoDir = path.join(tmpDir, 'repo');
    dbPath = path.join(tmpDir, 'test.sqlite');
    fs.mkdirSync(repoDir, { recursive: true });

    // Use a class with an interface so the inheritance table gets an entry.
    // Without an inheritance entry, the indexer's backfill check would force
    // a re-index on every call, masking the mtime-based incremental logic.
    createMavenArtifact(repoDir, {
      groupId: 'com.example',
      artifactId: 'demo',
      version: '1.0.0',
      classes: [{ name: 'com.example.Foo', interfaces: ['java.io.Serializable'] }],
    });

    const configMod = await import('../src/core/config.js');
    DB = (await import('../src/core/db/index.js')).DB;
    Indexer = (await import('../src/core/indexer.js')).Indexer;

    DB.reset();
    configMod.Config.reset();
    (Indexer as any).instance = undefined;

    DB.getInstance(dbPath);
    const config = await configMod.Config.getInstance();
    config.localRepository = repoDir;
    config.gradleRepository = '';

    indexer = Indexer.getInstance();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('does not re-index when mtime is unchanged', async () => {
    // First index
    await indexer.index();
    expect(indexer.searchClass('Foo').map((r: any) => r.className)).toContain('com.example.Foo');

    // Delete all classes_fts entries to detect re-indexing
    const db = openDb(dbPath);
    db.prepare('DELETE FROM classes_fts').run();
    db.close();

    // Second index — mtime unchanged, should skip re-indexing
    await indexer.index();

    // classes_fts should still be empty (not re-indexed)
    const db2 = openDb(dbPath);
    const count = (db2.prepare('SELECT COUNT(*) as n FROM classes_fts').get() as { n: number }).n;
    db2.close();
    expect(count).toBe(0);
  });

  it('re-indexes when directory mtime changes', async () => {
    await indexer.index();

    const artifactDir = path.join(repoDir, 'com', 'example', 'demo', '1.0.0');

    // Delete classes_fts entries
    const db = openDb(dbPath);
    db.prepare('DELETE FROM classes_fts').run();
    db.close();

    // Change directory mtime to the future
    const future = new Date(Date.now() + 10000);
    fs.utimesSync(artifactDir, future, future);

    // Re-index — mtime changed, should re-index
    await indexer.index();

    const db2 = openDb(dbPath);
    const count = (db2.prepare('SELECT COUNT(*) as n FROM classes_fts').get() as { n: number }).n;
    db2.close();
    expect(count).toBe(1);
    expect(indexer.searchClass('Foo').map((r: any) => r.className)).toContain('com.example.Foo');
  });

  it('forces full scan when last_full_scan is older than the interval', async () => {
    await indexer.index();

    const artifactDir = path.join(repoDir, 'com', 'example', 'demo', '1.0.0');

    // Delete classes_fts entries
    const db = openDb(dbPath);
    db.prepare('DELETE FROM classes_fts').run();

    // Set last_full_scan to 25 hours ago (past the 24h default interval)
    const oldTime = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_full_scan', ?)").run(oldTime);
    db.close();

    // Do NOT change directory mtime — full scan should still force re-index
    const statBefore = fs.statSync(artifactDir);

    await indexer.index();

    const db2 = openDb(dbPath);
    const count = (db2.prepare('SELECT COUNT(*) as n FROM classes_fts').get() as { n: number }).n;
    db2.close();
    expect(count).toBe(1);
    expect(indexer.searchClass('Foo').map((r: any) => r.className)).toContain('com.example.Foo');
  });

  it('prunes artifacts whose JAR no longer exists on disk', async () => {
    await indexer.index();
    expect(indexer.searchClass('Foo').map((r: any) => r.className)).toContain('com.example.Foo');

    // Delete the JAR
    const jarPath = path.join(repoDir, 'com', 'example', 'demo', '1.0.0', 'demo-1.0.0.jar');
    fs.unlinkSync(jarPath);

    // Re-index — should prune the artifact
    await indexer.index();

    const db = openDb(dbPath);
    const rows = db.prepare('SELECT * FROM artifacts WHERE group_id=? AND artifact_id=? AND version=?')
      .all('com.example', 'demo', '1.0.0');
    db.close();
    expect(rows).toHaveLength(0);
  });
});
