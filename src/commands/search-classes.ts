import { DB } from '../core/db/index.js';
import { Indexer } from '../core/indexer.js';
import { GlobalOpts, resolveDbPath, assertIndexNotEmpty } from './shared.js';
import { print } from '../output.js';

export interface SearchClassesOpts extends GlobalOpts {
  limit?: number;
  exact?: boolean;
  regex?: boolean;
  simpleNameOnly?: boolean;
  packageOnly?: boolean;
  caseSensitive?: boolean;
}

export async function run(query: string, opts: SearchClassesOpts): Promise<void> {
  if (opts.simpleNameOnly && opts.packageOnly) {
    process.stderr.write('Error: --simple-name-only and --package-only cannot be used together.\n');
    process.exit(1);
  }

  const db = DB.getInstance(resolveDbPath());
  assertIndexNotEmpty(db);

  const indexer = Indexer.getInstance();
  const results = indexer.searchClass(query, opts.limit, {
    exact: opts.exact,
    regex: opts.regex,
    simpleNameOnly: opts.simpleNameOnly,
    packageOnly: opts.packageOnly,
    caseSensitive: opts.caseSensitive,
  });

  print('search-classes', results, opts);
}
