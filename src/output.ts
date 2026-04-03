import { Artifact } from './core/indexer.js';

export function print(command: string, result: any, opts: { json?: boolean }): void {
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
    case 'get-class': {
      text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      break;
    }
    default: {
      text = JSON.stringify(result, null, 2);
    }
  }

  process.stdout.write(text + '\n');
}
