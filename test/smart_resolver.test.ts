import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';

/**
 * Integration test: smart_resolver with unqualified class name.
 *
 * We create a temp dir with a sample MyClass.java file containing a package declaration,
 * then call resolve('MyClass', tmpDir) and assert it finds the package and constructs the FQN.
 * The Indexer.index call is mocked to avoid actual scanning.
 */

describe('smart_resolver: resolve unqualified class name', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-cli-resolver-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('finds package from MyClass.java and constructs FQN', async () => {
    // Create a sample Java file with a package declaration
    const srcDir = path.join(tmpDir, 'src', 'main', 'java', 'com', 'example');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'MyClass.java'),
      `package com.example;\n\npublic class MyClass {\n    // sample class\n}\n`
    );

    // Mock the Indexer singleton to avoid actual scanning
    const mockSearchClass = vi.fn().mockReturnValue([
      { className: 'com.example.MyClass', artifacts: [] },
    ]);
    const mockIndex = vi.fn().mockResolvedValue(undefined);

    vi.doMock('../src/core/indexer.js', () => ({
      Indexer: {
        getInstance: () => ({
          index: mockIndex,
          searchClass: mockSearchClass,
        }),
      },
    }));

    const { resolve } = await import('../src/smart_resolver.js');
    const result = await resolve('MyClass', tmpDir);

    expect(result).toBe('com.example.MyClass');
    expect(mockIndex).toHaveBeenCalledWith(
      expect.objectContaining({ groupIdPrefix: 'com.example', quickScan: true })
    );
    expect(mockSearchClass).toHaveBeenCalledWith('com.example.MyClass');
  });

  it('returns null when no matching source file is found', async () => {
    // Empty tmpDir — no Java files
    vi.doMock('../src/core/indexer.js', () => ({
      Indexer: {
        getInstance: () => ({
          index: vi.fn().mockResolvedValue(undefined),
          searchClass: vi.fn().mockReturnValue([]),
        }),
      },
    }));

    const { resolve } = await import('../src/smart_resolver.js');
    const result = await resolve('NonExistentClass', tmpDir);

    expect(result).toBeNull();
  });

  it('returns null when source file has no package declaration', async () => {
    // Create a Java file without a package declaration
    fs.writeFileSync(
      path.join(tmpDir, 'MyClass.java'),
      `public class MyClass {\n    // no package\n}\n`
    );

    vi.doMock('../src/core/indexer.js', () => ({
      Indexer: {
        getInstance: () => ({
          index: vi.fn().mockResolvedValue(undefined),
          searchClass: vi.fn().mockReturnValue([]),
        }),
      },
    }));

    const { resolve } = await import('../src/smart_resolver.js');
    const result = await resolve('MyClass', tmpDir);

    expect(result).toBeNull();
  });
});
