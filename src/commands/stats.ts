import { DB } from '../core/db/index.js';
import { Indexer } from '../core/indexer.js';
import { GlobalOpts, resolveDbPath } from './shared.js';
import { print } from '../output.js';

export async function run(opts: GlobalOpts): Promise<void> {
  DB.getInstance(resolveDbPath());

  const indexer = Indexer.getInstance();
  const stats = indexer.getStats();

  print('stats', stats, opts);
}
