import { Artifact, ArtifactInfo, IndexStats } from './core/indexer.js';
import type { MissingArtifact } from './commands/doctor.js';

export type CommandResult =
  | { command: 'search-classes'; result: { className: string; artifacts: Artifact[] }[] }
  | { command: 'search-artifacts'; result: Artifact[] }
  | { command: 'search-implementations'; result: { className: string; artifacts: Artifact[] }[] }
  | { command: 'search-resources'; result: { path: string; artifact: Artifact }[] }
  | { command: 'search-methods'; result: { methodName: string; className: string; artifacts: Artifact[] }[] }
  | { command: 'get-class'; result: string }
  | { command: 'info'; result: ArtifactInfo[] }
  | { command: 'stats'; result: IndexStats }
  | { command: 'list-classes'; result: string[] }
  | { command: 'get-resource'; result: { path: string; content: string; type: string } | null }
  | { command: 'get-dependencies'; result: { groupId: string; artifactId: string; version: string; scope: string; optional: boolean }[] }
  | { command: 'find-dependents'; result: { groupId: string; artifactId: string; version: string; scope: string }[] }
  | { command: 'doctor'; result: MissingArtifact[] }
  | { command: string; result: unknown };

export function print(command: CommandResult['command'], result: unknown, opts: { json?: boolean }): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  let text: string;

  switch (command) {
    case 'search-classes': {
      const items = result as { className: string; artifacts: Artifact[] }[];
      if (items.length === 0) {
        text = 'No classes found.';
      } else {
        text = items.map(m => {
          const arts = m.artifacts.map(a => `  ${a.groupId}:${a.artifactId}:${a.version}`).join('\n');
          return `Class: ${m.className}\n${arts}`;
        }).join('\n\n');
      }
      break;
    }
    case 'search-artifacts': {
      const items = result as Artifact[];
      if (items.length === 0) {
        text = 'No artifacts found.';
      } else {
        text = items.map(a => `${a.groupId}:${a.artifactId}:${a.version} (Has Source: ${Boolean(a.hasSource)})`).join('\n');
      }
      break;
    }
    case 'search-implementations': {
      const items = result as { className: string; artifacts: Artifact[] }[];
      if (items.length === 0) {
        text = 'No implementations found.';
      } else {
        text = items.map(m => {
          const arts = m.artifacts.map(a => `  ${a.groupId}:${a.artifactId}:${a.version}`).join('\n');
          return `Implementation: ${m.className}\n${arts}`;
        }).join('\n\n');
      }
      break;
    }
    case 'search-resources': {
      const items = result as { path: string; artifact: Artifact }[];
      if (items.length === 0) {
        text = 'No resources found.';
      } else {
        text = items.map(m =>
          `Resource: ${m.path}\n  Artifact: ${m.artifact.groupId}:${m.artifact.artifactId}:${m.artifact.version}`
        ).join('\n\n');
      }
      break;
    }
    case 'search-methods': {
      const items = result as { methodName: string; className: string; artifacts: Artifact[] }[];
      if (items.length === 0) {
        text = 'No methods found.';
      } else {
        text = items.map(m => {
          const arts = m.artifacts.map(a => `  ${a.groupId}:${a.artifactId}:${a.version}`).join('\n');
          return `Method: ${m.methodName}\n  Class: ${m.className}\n${arts}`;
        }).join('\n\n');
      }
      break;
    }
    case 'get-class': {
      text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      break;
    }
    case 'info': {
      const items = result as ArtifactInfo[];
      if (items.length === 0) {
        text = 'No artifacts found.';
      } else {
        text = items.map(item => {
          const a = item.artifact;
          return [
            `Artifact: ${a.groupId}:${a.artifactId}:${a.version}`,
            `  Path: ${a.abspath}`,
            `  Layout: ${a.layout ?? 'unknown'}`,
            `  Has Source: ${a.hasSource}`,
            `  Main JAR Exists: ${item.mainJarExists}`,
            `  Class Count: ${item.classCount}`,
            `  Resource Count: ${item.resourceCount}`,
          ].join('\n');
        }).join('\n\n');
      }
      break;
    }
    case 'stats': {
      const stats = result as IndexStats;
      text = [
        `DB Path: ${stats.dbPath}`,
        `DB Size: ${stats.dbSizeBytes} bytes`,
        `Last Indexed At: ${stats.lastIndexedAt ?? 'never'}`,
        `Artifact Count: ${stats.artifactCount}`,
        `Class Count: ${stats.classCount}`,
        `Resource Count: ${stats.resourceCount}`,
      ].join('\n');
      break;
    }
    case 'list-classes': {
      const items = result as string[];
      if (items.length === 0) {
        text = 'No classes found.';
      } else {
        text = items.join('\n');
      }
      break;
    }
    case 'get-resource': {
      const resource = result as { path: string; content: string; type: string } | null;
      if (!resource) {
        text = 'Resource not found.';
      } else {
        text = `Path: ${resource.path}\nType: ${resource.type}\n\n${resource.content}`;
      }
      break;
    }
    case 'get-dependencies': {
      const items = result as { groupId: string; artifactId: string; version: string; scope: string; optional: boolean }[];
      if (items.length === 0) {
        text = 'No dependencies found.';
      } else {
        text = items.map(d => {
          const versionPart = d.version ? `:${d.version}` : '';
          const optPart = d.optional ? ' (optional)' : '';
          return `${d.groupId}:${d.artifactId}${versionPart} (scope: ${d.scope})${optPart}`;
        }).join('\n');
      }
      break;
    }
    case 'find-dependents': {
      const items = result as { groupId: string; artifactId: string; version: string; scope: string }[];
      if (items.length === 0) {
        text = 'No dependents found.';
      } else {
        text = items.map(d => `${d.groupId}:${d.artifactId}:${d.version} (scope: ${d.scope})`).join('\n');
      }
      break;
    }
    case 'doctor': {
      const items = result as MissingArtifact[];
      if (items.length === 0) {
        text = 'No missing artifacts found.';
      } else {
        text = `Missing artifacts (${items.length}):\n` + items
          .map(m => `  ${m.groupId}:${m.artifactId}:${m.version} (${m.abspath})`)
          .join('\n');
      }
      break;
    }
    default: {
      text = JSON.stringify(result, null, 2);
    }
  }

  process.stdout.write(text + '\n');
}
