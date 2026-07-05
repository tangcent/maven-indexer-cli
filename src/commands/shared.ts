import { DB } from '../core/db/index.js';
import { resolveDbPath } from '../core/constants.js';

export interface GlobalOpts {
  json: boolean;
}

export { resolveDbPath };

export function assertIndexNotEmpty(db: DB): void {
  const row = db.prepare('SELECT COUNT(*) as n FROM artifacts WHERE is_indexed = 1').get() as { n: number };
  if (row.n === 0) {
    process.stderr.write('Index is empty. Run `maven-indexer-cli refresh-index` to build the index.\n');
    process.exit(1);
  }
}
