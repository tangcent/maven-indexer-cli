import { DB } from '../core/db/index.js';
import { Indexer } from '../core/indexer.js';
import { GlobalOpts, resolveDbPath } from './shared.js';

export async function run(opts: { quick?: boolean; full?: boolean } & GlobalOpts): Promise<void> {
  DB.getInstance(resolveDbPath());

  const indexer = Indexer.getInstance();

  if (opts.full) {
    await indexer.refresh({ quickScan: false });
  } else {
    await indexer.refresh({ quickScan: true });
  }

  process.stdout.write('Index refresh complete.\n');
  process.exit(0);
}
