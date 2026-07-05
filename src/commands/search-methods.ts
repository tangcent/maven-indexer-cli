import { DB } from '../core/db/index.js';
import { Indexer } from '../core/indexer.js';
import { GlobalOpts, resolveDbPath, assertIndexNotEmpty } from './shared.js';
import { print } from '../output.js';

export interface SearchMethodsOpts extends GlobalOpts {
  limit?: number;
  exact?: boolean;
  caseSensitive?: boolean;
}

export async function run(name: string, opts: SearchMethodsOpts): Promise<void> {
  const db = DB.getInstance(resolveDbPath());
  assertIndexNotEmpty(db);

  const indexer = Indexer.getInstance();
  const results = indexer.searchMethods(name, {
    exact: opts.exact,
    caseSensitive: opts.caseSensitive,
    limit: opts.limit,
  });

  print('search-methods', results, opts);
}
