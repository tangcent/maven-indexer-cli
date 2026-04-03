import fs from 'fs/promises';
import path from 'path';
import { Indexer } from './core/indexer.js';

/**
 * Resolves a simple (unqualified) class name to a fully qualified name
 * by searching the project source files and triggering a targeted index scan.
 */
export async function resolve(simpleName: string, basePath: string): Promise<string | null> {
  process.stderr.write(`[smart_resolver] Resolving '${simpleName}' from '${basePath}'\n`);

  const candidates = await findSourceFiles(basePath, simpleName);

  if (candidates.length === 0) {
    process.stderr.write(`[smart_resolver] No source files found matching '${simpleName}'\n`);
    return null;
  }

  for (const filePath of candidates) {
    process.stderr.write(`[smart_resolver] Checking file: ${filePath}\n`);

    const pkg = await extractPackage(filePath);
    if (!pkg) {
      process.stderr.write(`[smart_resolver] No package declaration found in ${filePath}\n`);
      continue;
    }

    const fqn = `${pkg}.${simpleName}`;
    process.stderr.write(`[smart_resolver] Constructed FQN: ${fqn}\n`);

    // Extract top-2 package segments
    const segments = pkg.split('.');
    const topPackage = segments.slice(0, 2).join('.');
    process.stderr.write(`[smart_resolver] Triggering targeted scan for groupIdPrefix: ${topPackage}\n`);

    const indexer = Indexer.getInstance();
    await indexer.index({ groupIdPrefix: topPackage, quickScan: true });

    process.stderr.write(`[smart_resolver] Re-querying index for FQN: ${fqn}\n`);
    const results = indexer.searchClass(fqn);
    const exact = results.find(r => r.className === fqn);

    if (exact) {
      process.stderr.write(`[smart_resolver] Found FQN in index: ${fqn}\n`);
      return fqn;
    }

    process.stderr.write(`[smart_resolver] FQN '${fqn}' not found in index after scan\n`);
  }

  return null;
}

async function findSourceFiles(basePath: string, simpleName: string): Promise<string[]> {
  const results: string[] = [];

  const walk = async (dir: string) => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'build' || entry.name === 'target') {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        const stem = path.basename(entry.name, ext);
        if ((ext === '.java' || ext === '.kt') && stem === simpleName) {
          results.push(fullPath);
        }
      }
    }
  };

  await walk(basePath);
  return results;
}

async function extractPackage(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').slice(0, 20).join('\n');
    const match = /^package\s+([\w.]+)/m.exec(lines);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
