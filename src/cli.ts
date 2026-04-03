#!/usr/bin/env node
import { Command } from 'commander';
import { GlobalOpts } from './commands/shared.js';
import * as searchClasses from './commands/search-classes.js';
import * as searchArtifacts from './commands/search-artifacts.js';
import * as searchImplementations from './commands/search-implementations.js';
import * as searchResources from './commands/search-resources.js';
import * as getClass from './commands/get-class.js';
import * as refreshIndex from './commands/refresh-index.js';

const program = new Command();

program
  .name('maven-indexer-cli')
  .description('CLI tool for querying the local Maven/Gradle artifact index')
  .version('1.0.0')
  .option('--json', 'Output results as JSON', false);

program
  .command('search-classes <query>')
  .description('Search for Java classes in the index')
  .option('--limit <n>', 'Maximum number of results', (v) => parseInt(v, 10))
  .action(async (query: string, cmdOpts: { limit?: number }) => {
    const globalOpts = getGlobalOpts();
    await searchClasses.run(query, { ...cmdOpts, ...globalOpts });
  });

program
  .command('search-artifacts <query>')
  .description('Search for artifacts by groupId, artifactId, or keyword')
  .option('--limit <n>', 'Maximum number of results', (v) => parseInt(v, 10))
  .action(async (query: string, cmdOpts: { limit?: number }) => {
    const globalOpts = getGlobalOpts();
    await searchArtifacts.run(query, { ...cmdOpts, ...globalOpts });
  });

program
  .command('search-implementations <className>')
  .description('Search for implementations of an interface or base class')
  .action(async (className: string) => {
    const globalOpts = getGlobalOpts();
    await searchImplementations.run(className, globalOpts);
  });

program
  .command('search-resources <pattern>')
  .description('Search for resources (proto files, XML configs, etc.) inside JARs')
  .action(async (pattern: string) => {
    const globalOpts = getGlobalOpts();
    await searchResources.run(pattern, globalOpts);
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
  .action(async (cmdOpts: { quick?: boolean; full?: boolean }) => {
    const globalOpts = getGlobalOpts();
    await refreshIndex.run({ ...cmdOpts, ...globalOpts });
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
