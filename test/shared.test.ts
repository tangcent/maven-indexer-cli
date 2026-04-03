import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { assertIndexNotEmpty } from '../src/commands/shared.js';

function createTempDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      artifact_id TEXT NOT NULL,
      version TEXT NOT NULL,
      abspath TEXT NOT NULL,
      has_source INTEGER DEFAULT 0,
      is_indexed INTEGER DEFAULT 0,
      UNIQUE(group_id, artifact_id, version)
    );
  `);
  return db;
}

describe('assertIndexNotEmpty', () => {
  let tmpDir: string;
  let dbPath: string;
  let rawDb: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-cli-test-'));
    dbPath = path.join(tmpDir, 'test.sqlite');
    rawDb = createTempDb(dbPath);
  });

  afterEach(() => {
    rawDb.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('exits with code 1 and correct message when index is empty', () => {
    const dbWrapper = {
      prepare: (sql: string) => rawDb.prepare(sql),
      transaction: <T>(fn: () => T): T => rawDb.transaction(fn)(),
    } as any;

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    assertIndexNotEmpty(dbWrapper);

    expect(stderrSpy).toHaveBeenCalledWith(
      'Index is empty. Run `maven-indexer-cli refresh-index` to build the index.\n'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does not exit when index has indexed artifacts', () => {
    rawDb.prepare(`
      INSERT INTO artifacts (group_id, artifact_id, version, abspath, has_source, is_indexed)
      VALUES ('com.example', 'demo', '1.0.0', '/tmp/demo', 0, 1)
    `).run();

    const dbWrapper = {
      prepare: (sql: string) => rawDb.prepare(sql),
      transaction: <T>(fn: () => T): T => rawDb.transaction(fn)(),
    } as any;

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    assertIndexNotEmpty(dbWrapper);

    expect(exitSpy).not.toHaveBeenCalled();
  });
});
