import { DB } from '../core/db/index.js';
import { Indexer } from '../core/indexer.js';
import { GlobalOpts, resolveDbPath, assertIndexNotEmpty } from './shared.js';
import { print } from '../output.js';
import { resolve as smartResolve } from '../smart_resolver.js';

export async function run(className: string, opts: GlobalOpts): Promise<void> {
  const db = DB.getInstance(resolveDbPath());
  assertIndexNotEmpty(db);

  const indexer = Indexer.getInstance();

  let resolvedName = className;
  if (!className.includes('.')) {
    const fqn = await smartResolve(className, process.cwd());
    if (fqn) {
      resolvedName = fqn;
    }
  }

  const results = indexer.searchImplementations(resolvedName);
  print('search-implementations', results, opts);
}
