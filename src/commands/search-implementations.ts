import { DB } from '../core/db/index.js';
import { Indexer } from '../core/indexer.js';
import { GlobalOpts, resolveDbPath } from './shared.js';
import { print } from '../output.js';
import { resolve as smartResolve } from '../smart_resolver.js';

export async function run(className: string, opts: GlobalOpts): Promise<void> {
  DB.getInstance(resolveDbPath());
  const indexer = Indexer.getInstance();

  let resolvedName = className;
  if (!className.includes('.')) {
    const fqn = await smartResolve(className, process.cwd());
    if (fqn) {
      resolvedName = fqn;
    } else if (!className.includes('.')) {
      // AC5: no source file found, fall through to simple-name search
      process.stderr.write(`No source file found for '${className}' in project, falling back to simple-name search.\n`);
    }
  }

  const results = indexer.searchImplementations(resolvedName);

  if (results.length === 0 && resolvedName === className) {
    // AC6: targeted scan didn't find it and no FQN was resolved
    process.stderr.write(`Could not resolve '${className}' to any known class or interface.\n`);
    print('search-implementations', [], opts);
    return;
  }

  print('search-implementations', results, opts);
}
