import path from 'path';
import os from 'os';
import { DB } from '../core/db/index.js';

export interface GlobalOpts {
  json: boolean;
}

export function resolveDbPath(): string {
  return process.env.DB_FILE ?? path.join(os.homedir(), '.maven-indexer-mcp', 'maven-index.sqlite');
}

export function assertIndexNotEmpty(db: DB): void {
  const row = db.prepare('SELECT COUNT(*) as n FROM artifacts WHERE is_indexed = 1').get() as { n: number };
  if (row.n === 0) {
    process.stderr.write('Index is empty. Run `maven-indexer-cli refresh-index` to build the index.\n');
    process.exit(1);
  }
}
