import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';

/**
 * Tests that get-class and search-implementations use the smart resolver
 * when given an unqualified class name, and produce the right output/messages.
 */

function makeIndexer(overrides: Partial<{
  searchClass: ReturnType<typeof vi.fn>;
  searchImplementations: ReturnType<typeof vi.fn>;
  index: ReturnType<typeof vi.fn>;
  getArtifactByCoordinate: ReturnType<typeof vi.fn>;
  getResourcesForClassInArtifact: ReturnType<typeof vi.fn>;
  getResourcesForClass: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    index: vi.fn().mockResolvedValue(undefined),
    searchClass: vi.fn().mockReturnValue([]),
    searchImplementations: vi.fn().mockReturnValue([]),
    getArtifactByCoordinate: vi.fn().mockReturnValue(undefined),
    getResourcesForClassInArtifact: vi.fn().mockReturnValue([]),
    getResourcesForClass: vi.fn().mockReturnValue([]),
    ...overrides,
  };
}

describe('get-class: smart resolver integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-cli-cmd-'));
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('resolves unqualified name via source file and returns class detail', async () => {
    // Create a Java source file so smart resolver can find the FQN
    const srcDir = path.join(tmpDir, 'src', 'main', 'java', 'com', 'example');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'MyService.java'),
      `package com.example;\npublic class MyService {}\n`
    );

    const fakeArtifact = {
      id: 1, groupId: 'com.example', artifactId: 'my-lib', version: '1.0.0',
      abspath: '/fake/path', hasSource: false,
    };

    const mockIndexer = makeIndexer({
      searchClass: vi.fn().mockReturnValue([
        { className: 'com.example.MyService', artifacts: [fakeArtifact] },
      ]),
    });

    vi.doMock('../src/core/indexer.js', () => ({
      Indexer: { getInstance: () => mockIndexer },
    }));
    vi.doMock('../src/core/db/index.js', () => ({
      DB: { getInstance: () => ({ prepare: vi.fn().mockReturnValue({ get: vi.fn(), run: vi.fn(), all: vi.fn().mockReturnValue([]) }) }) },
    }));
    vi.doMock('../src/core/source_parser.js', () => ({
      SourceParser: { getClassDetail: vi.fn().mockResolvedValue({ className: 'com.example.MyService', signatures: ['void doWork()'], doc: null, source: null, language: 'java' }) },
    }));
    vi.doMock('../src/core/artifact_resolver.js', () => ({
      ArtifactResolver: { resolveBestArtifact: vi.fn().mockResolvedValue(fakeArtifact) },
    }));
    vi.doMock('../src/commands/shared.js', () => ({
      resolveDbPath: () => ':memory:',
      GlobalOpts: {},
    }));

    const printCalls: any[] = [];
    vi.doMock('../src/output.js', () => ({
      print: vi.fn((_cmd: string, text: string) => printCalls.push(text)),
    }));

    // Spy on stderr to capture diagnostic messages
    const stderrMessages: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((s: any) => {
      stderrMessages.push(String(s));
      return true;
    });

    // Run from tmpDir so smart resolver searches there
    const origCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const { run } = await import('../src/commands/get-class.js');
      await run('MyService', { json: false });
    } finally {
      process.cwd = origCwd;
    }

    // Smart resolver should have triggered a targeted scan
    expect(mockIndexer.index).toHaveBeenCalledWith(
      expect.objectContaining({ groupIdPrefix: 'com.example', quickScan: true })
    );
    // Should have searched for the resolved FQN
    expect(mockIndexer.searchClass).toHaveBeenCalledWith('com.example.MyService');
    // Stderr should mention the source file found (no [smart_resolver] prefix)
    expect(stderrMessages.some(m => m.includes('MyService.java'))).toBe(true);
    expect(stderrMessages.every(m => !m.includes('[smart_resolver]'))).toBe(true);
    // Output should contain the class detail
    expect(printCalls[0]).toContain('com.example.MyService');
  });

  it('suggests refresh-index when targeted scan does not find the class', async () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'UnknownClass.java'),
      `package com.example;\npublic class UnknownClass {}\n`
    );

    // Indexer never finds the class even after scan
    const mockIndexer = makeIndexer({
      searchClass: vi.fn().mockReturnValue([]),
    });

    vi.doMock('../src/core/indexer.js', () => ({
      Indexer: { getInstance: () => mockIndexer },
    }));
    vi.doMock('../src/core/db/index.js', () => ({
      DB: { getInstance: () => ({ prepare: vi.fn().mockReturnValue({ get: vi.fn(), run: vi.fn(), all: vi.fn().mockReturnValue([]) }) }) },
    }));
    vi.doMock('../src/commands/shared.js', () => ({
      resolveDbPath: () => ':memory:',
      GlobalOpts: {},
    }));
    vi.doMock('../src/output.js', () => ({ print: vi.fn() }));

    const stderrMessages: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((s: any) => {
      stderrMessages.push(String(s));
      return true;
    });

    const origCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const { run } = await import('../src/commands/get-class.js');
      await run('UnknownClass', { json: false });
    } finally {
      process.cwd = origCwd;
    }

    // Should suggest refresh-index
    expect(stderrMessages.some(m => m.includes('refresh-index'))).toBe(true);
    expect(stderrMessages.every(m => !m.includes('[smart_resolver]'))).toBe(true);
  });
});

describe('search-implementations: smart resolver integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-cli-impl-'));
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('resolves unqualified interface name and returns implementations', async () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'MyInterface.java'),
      `package com.example;\npublic interface MyInterface {}\n`
    );

    const fakeImpl = {
      className: 'com.example.MyInterfaceImpl',
      artifacts: [{ id: 1, groupId: 'com.example', artifactId: 'my-lib', version: '1.0.0', abspath: '/fake', hasSource: false }],
    };

    const mockIndexer = makeIndexer({
      searchClass: vi.fn().mockReturnValue([
        { className: 'com.example.MyInterface', artifacts: fakeImpl.artifacts },
      ]),
      searchImplementations: vi.fn().mockReturnValue([fakeImpl]),
    });

    vi.doMock('../src/core/indexer.js', () => ({
      Indexer: { getInstance: () => mockIndexer },
    }));
    vi.doMock('../src/core/db/index.js', () => ({
      DB: { getInstance: () => ({}) },
    }));
    vi.doMock('../src/commands/shared.js', () => ({
      resolveDbPath: () => ':memory:',
    }));

    const printCalls: any[] = [];
    vi.doMock('../src/output.js', () => ({
      print: vi.fn((_cmd: string, data: any) => printCalls.push(data)),
    }));

    const origCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const { run } = await import('../src/commands/search-implementations.js');
      await run('MyInterface', { json: false });
    } finally {
      process.cwd = origCwd;
    }

    expect(mockIndexer.index).toHaveBeenCalledWith(
      expect.objectContaining({ groupIdPrefix: 'com.example', quickScan: true })
    );
    expect(mockIndexer.searchImplementations).toHaveBeenCalledWith('com.example.MyInterface');
    expect(printCalls[0]).toEqual([fakeImpl]);
  });

  it('falls back to simple-name search when no source file found', async () => {
    // Empty tmpDir — no source files
    const mockIndexer = makeIndexer({
      searchImplementations: vi.fn().mockReturnValue([]),
    });

    vi.doMock('../src/core/indexer.js', () => ({
      Indexer: { getInstance: () => mockIndexer },
    }));
    vi.doMock('../src/core/db/index.js', () => ({
      DB: { getInstance: () => ({}) },
    }));
    vi.doMock('../src/commands/shared.js', () => ({
      resolveDbPath: () => ':memory:',
    }));

    const stderrMessages: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((s: any) => {
      stderrMessages.push(String(s));
      return true;
    });
    vi.doMock('../src/output.js', () => ({ print: vi.fn() }));

    const origCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const { run } = await import('../src/commands/search-implementations.js');
      await run('SomeInterface', { json: false });
    } finally {
      process.cwd = origCwd;
    }

    // No targeted scan triggered (no source file found)
    expect(mockIndexer.index).not.toHaveBeenCalled();
    // Falls back to simple-name, gets no results → descriptive message
    expect(stderrMessages.some(m => m.includes('Could not resolve') || m.includes('falling back'))).toBe(true);
    expect(stderrMessages.every(m => !m.includes('[smart_resolver]'))).toBe(true);
  });
});
