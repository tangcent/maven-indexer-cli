import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

/**
 * Integration tests for refresh-index quick/full scan modes.
 *
 * These tests use a real SQLite DB and a small fixture Maven repo structure.
 * We test the DB state after indexing to verify quick vs full scan behavior.
 */

function createFixtureRepo(repoDir: string) {
  // Create two versions of the same artifact: com.example:demo:1.0.0 and 2.0.0
  for (const version of ['1.0.0', '2.0.0']) {
    const artifactDir = path.join(repoDir, 'com', 'example', 'demo', version);
    fs.mkdirSync(artifactDir, { recursive: true });
    // Create a minimal POM file (required for scanRepository to detect the artifact)
    fs.writeFileSync(
      path.join(artifactDir, `demo-${version}.pom`),
      `<project><groupId>com.example</groupId><artifactId>demo</artifactId><version>${version}</version></project>`
    );
    // Create an empty JAR (so indexArtifactClasses doesn't fail fatally)
    fs.writeFileSync(path.join(artifactDir, `demo-${version}.jar`), '');
  }

  // Create a second artifact: com.example:other:1.0.0
  const otherDir = path.join(repoDir, 'com', 'example', 'other', '1.0.0');
  fs.mkdirSync(otherDir, { recursive: true });
  fs.writeFileSync(
    path.join(otherDir, 'other-1.0.0.pom'),
    `<project><groupId>com.example</groupId><artifactId>other</artifactId><version>1.0.0</version></project>`
  );
  fs.writeFileSync(path.join(otherDir, 'other-1.0.0.jar'), '');
}

function openDb(dbPath: string): Database.Database {
  return new Database(dbPath);
}

describe('refresh-index integration', () => {
  let tmpDir: string;
  let repoDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-cli-refresh-'));
    repoDir = path.join(tmpDir, 'repo');
    dbPath = path.join(tmpDir, 'test.sqlite');
    fs.mkdirSync(repoDir, { recursive: true });
    createFixtureRepo(repoDir);

    // Reset DB singleton and Config singleton for each test
    (Database as any)._testPath = dbPath;
    process.env.DB_FILE = dbPath;
  });

  afterEach(() => {
    delete process.env.DB_FILE;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('quick scan indexes only best version per groupId:artifactId', async () => {
    // We test the quick scan filtering logic by directly using the Indexer
    // with a mocked config pointing to our fixture repo.
    const { DB } = await import('../src/core/db/index.js');
    const { Config } = await import('../src/core/config.js');
    const { Indexer } = await import('../src/core/indexer.js');

    // Reset singletons
    (DB as any).instance = undefined;
    Config.reset();
    (Indexer as any).instance = undefined;

    // Initialize DB with our temp path
    DB.getInstance(dbPath);

    // Configure to use our fixture repo
    const config = await Config.getInstance();
    config.localRepository = repoDir;
    config.gradleRepository = '';

    const indexer = Indexer.getInstance();
    await indexer.refresh({ quickScan: true });

    // Check DB: should have at most 1 version per groupId:artifactId
    const db = openDb(dbPath);
    const rows = db.prepare(`
      SELECT group_id, artifact_id, COUNT(*) as cnt
      FROM artifacts
      GROUP BY group_id, artifact_id
    `).all() as { group_id: string; artifact_id: string; cnt: number }[];

    db.close();

    // Every group should have exactly 1 version after quick scan
    for (const row of rows) {
      expect(row.cnt).toBe(1);
    }

    // We should have 2 distinct artifacts (demo and other)
    expect(rows.length).toBe(2);
  });

  it('full scan indexes all versions', async () => {
    const { DB } = await import('../src/core/db/index.js');
    const { Config } = await import('../src/core/config.js');
    const { Indexer } = await import('../src/core/indexer.js');

    // Reset singletons
    (DB as any).instance = undefined;
    Config.reset();
    (Indexer as any).instance = undefined;

    DB.getInstance(dbPath);

    const config = await Config.getInstance();
    config.localRepository = repoDir;
    config.gradleRepository = '';

    const indexer = Indexer.getInstance();
    await indexer.refresh({ quickScan: false });

    // Check DB: demo should have 2 versions
    const db = openDb(dbPath);
    const demoRows = db.prepare(`
      SELECT version FROM artifacts WHERE group_id = 'com.example' AND artifact_id = 'demo'
    `).all() as { version: string }[];

    db.close();

    expect(demoRows.length).toBe(2);
    const versions = demoRows.map(r => r.version);
    expect(versions).toContain('1.0.0');
    expect(versions).toContain('2.0.0');
  });
});
