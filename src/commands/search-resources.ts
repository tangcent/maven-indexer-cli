import { DB } from '../core/db/index.js';
import { Indexer } from '../core/indexer.js';
import { GlobalOpts, resolveDbPath, assertIndexNotEmpty } from './shared.js';
import { print } from '../output.js';

export async function run(pattern: string, opts: { limit?: number } & GlobalOpts): Promise<void> {
  const db = DB.getInstance(resolveDbPath());
  assertIndexNotEmpty(db);

  const indexer = Indexer.getInstance();
  const results = indexer.searchResources(pattern, opts.limit);
  print('search-resources', results, opts);
}
