#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { GlobalOpts } from './commands/shared.js';
import * as searchClasses from './commands/search-classes.js';
import * as searchArtifacts from './commands/search-artifacts.js';
import * as searchImplementations from './commands/search-implementations.js';
import * as searchResources from './commands/search-resources.js';
import * as searchMethods from './commands/search-methods.js';
import * as getClass from './commands/get-class.js';
import * as refreshIndex from './commands/refresh-index.js';
import * as info from './commands/info.js';
import * as stats from './commands/stats.js';
import * as listClasses from './commands/list-classes.js';
import * as getResource from './commands/get-resource.js';
import * as getDependencies from './commands/get-dependencies.js';
import * as findDependents from './commands/find-dependents.js';
import * as doctor from './commands/doctor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return (pkg.version as string) ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function parseLimit(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new InvalidArgumentError(`Expected a positive integer, got '${value}'.`);
  }
  return n;
}

const program = new Command();

program
  .name('maven-indexer-cli')
  .description('CLI tool for querying the local Maven/Gradle artifact index')
  .version(readVersion())
  .option('--json', 'Output results as JSON', false);

program
  .command('search-classes <query>')
  .description('Search for Java classes in the index')
  .option('--limit <n>', 'Maximum number of results', parseLimit)
  .option('--exact', 'Exact match only')
  .option('--regex', 'Treat query as regex')
  .option('--simple-name-only', 'Search simple name only')
  .option('--package-only', 'Search package prefix only')
  .option('--case-sensitive', 'Case-sensitive matching')
  .action(async (query: string, cmdOpts: { limit?: number; exact?: boolean; regex?: boolean; simpleNameOnly?: boolean; packageOnly?: boolean; caseSensitive?: boolean }) => {
    const globalOpts = getGlobalOpts();
    await searchClasses.run(query, { ...cmdOpts, ...globalOpts });
  });

program
  .command('search-artifacts <query>')
  .description('Search for artifacts by groupId, artifactId, or keyword')
  .option('--limit <n>', 'Maximum number of results', parseLimit)
  .action(async (query: string, cmdOpts: { limit?: number }) => {
    const globalOpts = getGlobalOpts();
    await searchArtifacts.run(query, { ...cmdOpts, ...globalOpts });
  });

program
  .command('search-implementations <className>')
  .description('Search for implementations of an interface or base class')
  .option('--limit <n>', 'Maximum number of results', parseLimit)
  .action(async (className: string, cmdOpts: { limit?: number }) => {
    const globalOpts = getGlobalOpts();
    await searchImplementations.run(className, { ...cmdOpts, ...globalOpts });
  });

program
  .command('search-resources <pattern>')
  .description('Search for resources (proto files, XML configs, etc.) inside JARs')
  .option('--limit <n>', 'Maximum number of results', parseLimit)
  .action(async (pattern: string, cmdOpts: { limit?: number }) => {
    const globalOpts = getGlobalOpts();
    await searchResources.run(pattern, { ...cmdOpts, ...globalOpts });
  });

program
  .command('search-methods <name>')
  .description('Search for Java methods by name in the index')
  .option('--limit <n>', 'Maximum number of results', parseLimit)
  .option('--exact', 'Exact match only')
  .option('--case-sensitive', 'Case-sensitive matching')
  .action(async (name: string, cmdOpts: { limit?: number; exact?: boolean; caseSensitive?: boolean }) => {
    const globalOpts = getGlobalOpts();
    await searchMethods.run(name, { ...cmdOpts, ...globalOpts });
  });

program
  .command('get-class <className>')
  .description('Get class details (signatures, docs, or source)')
  .option('--type <type>', 'Detail type: signatures, docs, or source', 'signatures')
  .option('--coordinate <coordinate>', 'Maven coordinate (groupId:artifactId:version)')
  .action(async (className: string, cmdOpts: { type?: string; coordinate?: string }) => {
    const globalOpts = getGlobalOpts();
    await getClass.run(className, { ...cmdOpts, ...globalOpts });
  });

program
  .command('refresh-index')
  .description('Refresh the artifact index')
  .option('--quick', 'Index only the best version per artifact (default)')
  .option('--full', 'Index all versions of all artifacts')
  .option('--watch', 'Watch for changes and re-index automatically')
  .action(async (cmdOpts: { quick?: boolean; full?: boolean; watch?: boolean }) => {
    const globalOpts = getGlobalOpts();
    await refreshIndex.run({ ...cmdOpts, ...globalOpts });
  });

program
  .command('info <coordinate>')
  .description('Show artifact info (path, layout, class count, resource count). Coordinate format: groupId:artifactId[:version]')
  .action(async (coordinate: string) => {
    const globalOpts = getGlobalOpts();
    await info.run(coordinate, globalOpts);
  });

program
  .command('stats')
  .description('Show aggregate statistics about the index (artifact count, class count, db size, etc.)')
  .action(async () => {
    const globalOpts = getGlobalOpts();
    await stats.run(globalOpts);
  });

program
  .command('list-classes <coordinate>')
  .description('List all classes indexed for an artifact. Coordinate format: groupId:artifactId:version')
  .action(async (coordinate: string) => {
    const globalOpts = getGlobalOpts();
    await listClasses.run(coordinate, globalOpts);
  });

program
  .command('get-resource <coordinate> <resourcePath>')
  .description('Get the content of an indexed resource (proto, XML, properties, etc.) inside an artifact JAR')
  .action(async (coordinate: string, resourcePath: string) => {
    const globalOpts = getGlobalOpts();
    await getResource.run(coordinate, resourcePath, globalOpts);
  });

program
  .command('get-dependencies <coordinate>')
  .description('List the Maven <dependencies> of an artifact. Coordinate format: groupId:artifactId:version')
  .action(async (coordinate: string) => {
    const globalOpts = getGlobalOpts();
    await getDependencies.run(coordinate, globalOpts);
  });

program
  .command('find-dependents <coordinate>')
  .description('Find indexed artifacts that depend on the given coordinate. Coordinate format: groupId:artifactId[:version] (version optional)')
  .action(async (coordinate: string) => {
    const globalOpts = getGlobalOpts();
    await findDependents.run(coordinate, globalOpts);
  });

program
  .command('doctor')
  .description('Check indexed artifacts for missing JARs on disk')
  .option('--prune', 'Delete stale artifact rows')
  .option('--json', 'Output as JSON')
  .action(async (cmdOpts: { prune?: boolean; json?: boolean }) => {
    const globalOpts = getGlobalOpts();
    await doctor.run({ prune: cmdOpts.prune, json: Boolean(cmdOpts.json) || globalOpts.json });
  });

// Handle unknown commands
program.on('command:*', () => {
  process.stderr.write(`Error: Unknown command '${program.args[0]}'\n`);
  process.stderr.write('Run with --help to see available commands.\n');
  process.exit(1);
});

function getGlobalOpts(): GlobalOpts {
  const opts = program.opts();
  return {
    json: Boolean(opts.json),
  };
}

// Parse args; if no command given, show help
program.parse(process.argv);

if (process.argv.length <= 2) {
  program.help();
}
