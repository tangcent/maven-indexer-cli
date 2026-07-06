import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { createMavenArtifact, cleanupSingletons } from './helpers.js';

/**
 * Tests the doctor command: reports missing artifacts and prunes them.
 * Covers T6A.7.
 */

function openDb(dbPath: string): Database.Database {
  return new Database(dbPath);
}

describe('doctor command', () => {
  let tmpDir: string;
  let repoDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-cli-doctor-'));
    repoDir = path.join(tmpDir, 'repo');
    dbPath = path.join(tmpDir, 'test.sqlite');
    fs.mkdirSync(repoDir, { recursive: true });

    process.env.DB_FILE = dbPath;
  });

  afterEach(async () => {
    delete process.env.DB_FILE;
    vi.restoreAllMocks();
    await cleanupSingletons();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports missing artifacts without pruning when --prune is not set', async () => {
    createMavenArtifact(repoDir, {
      groupId: 'com.example',
      artifactId: 'present',
      version: '1.0.0',
      classes: [{ name: 'com.example.Present' }],
    });
    createMavenArtifact(repoDir, {
      groupId: 'com.example',
      artifactId: 'absent',
      version: '1.0.0',
      classes: [{ name: 'com.example.Absent' }],
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

    // Delete one JAR to make the artifact "missing"
    fs.unlinkSync(path.join(repoDir, 'com', 'example', 'absent', '1.0.0', 'absent-1.0.0.jar'));

    // Capture stdout (print output)
    const stdout: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s: any) => { stdout.push(String(s)); return true; });

    const { run } = await import('../src/commands/doctor.js');
    await run({ prune: false, json: false });

    // Should report the missing artifact
    const output = stdout.join('');
    expect(output).toContain('com.example:absent:1.0.0');

    // Should NOT prune — the artifact row should still exist
    const db = openDb(dbPath);
    const rows = db.prepare('SELECT * FROM artifacts WHERE artifact_id=?').all('absent');
    db.close();
    expect(rows).toHaveLength(1);
  });

  it('prunes missing artifacts when --prune is set', async () => {
    createMavenArtifact(repoDir, {
      groupId: 'com.example',
      artifactId: 'present',
      version: '1.0.0',
      classes: [{ name: 'com.example.Present' }],
    });
    createMavenArtifact(repoDir, {
      groupId: 'com.example',
      artifactId: 'absent',
      version: '1.0.0',
      classes: [{ name: 'com.example.Absent' }],
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

    // Delete one JAR
    fs.unlinkSync(path.join(repoDir, 'com', 'example', 'absent', '1.0.0', 'absent-1.0.0.jar'));

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const { run } = await import('../src/commands/doctor.js');
    await run({ prune: true, json: false });

    // The missing artifact should be pruned
    const db = openDb(dbPath);
    const absentRows = db.prepare('SELECT * FROM artifacts WHERE artifact_id=?').all('absent');
    const presentRows = db.prepare('SELECT * FROM artifacts WHERE artifact_id=?').all('present');
    db.close();
    expect(absentRows).toHaveLength(0);
    expect(presentRows).toHaveLength(1);
  });
});
