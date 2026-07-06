import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { createMavenArtifact, cleanupSingletons } from './helpers.js';

/**
 * Tests search-mode flags on searchClass.
 * Covers T6A.6.
 */

describe('searchClass mode flags', () => {
  let tmpDir: string;
  let repoDir: string;
  let dbPath: string;
  let indexer: any;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-cli-search-flags-'));
    repoDir = path.join(tmpDir, 'repo');
    dbPath = path.join(tmpDir, 'test.sqlite');
    fs.mkdirSync(repoDir, { recursive: true });

    // Index three classes across two packages
    createMavenArtifact(repoDir, {
      groupId: 'com.example',
      artifactId: 'lib-a',
      version: '1.0.0',
      classes: [
        { name: 'com.example.FooBar' },
        { name: 'com.example.BarBaz' },
      ],
    });
    createMavenArtifact(repoDir, {
      groupId: 'org.test',
      artifactId: 'lib-b',
      version: '1.0.0',
      classes: [{ name: 'org.test.FooService' }],
    });

    const { DB } = await import('../src/core/db/index.js');
    const { Config } = await import('../src/core/config.js');
    const { Indexer } = await import('../src/core/indexer.js');

    DB.reset();
    Config.reset();
    (Indexer as any).instance = undefined;

    DB.getInstance(dbPath);
    const config = await Config.getInstance();
    config.localRepository = repoDir;
    config.gradleRepository = '';

    indexer = Indexer.getInstance();
    await indexer.index();
  });

  afterEach(async () => {
    await cleanupSingletons();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function classNames(results: { className: string }[]): string[] {
    return results.map(r => r.className).sort();
  }

  it('default FTS search matches by trigram substring', () => {
    const results = indexer.searchClass('Foo');
    const names = classNames(results);
    expect(names).toContain('com.example.FooBar');
    expect(names).toContain('org.test.FooService');
  });

  it('--exact flag matches only exact class_name or simple_name', () => {
    const results = indexer.searchClass('FooBar', 100, { exact: true });
    const names = classNames(results);
    expect(names).toEqual(['com.example.FooBar']);
  });

  it('--regex flag treats pattern as a regex', () => {
    const results = indexer.searchClass('Foo.*Bar', 100, { regex: true });
    const names = classNames(results);
    expect(names).toEqual(['com.example.FooBar']);
  });

  it('--simple-name-only flag restricts search to simple_name column', () => {
    const results = indexer.searchClass('Foo', 100, { simpleNameOnly: true });
    const names = classNames(results);
    expect(names).toContain('com.example.FooBar');
    expect(names).toContain('org.test.FooService');
    expect(names).not.toContain('com.example.BarBaz');
  });

  it('--simple-name-only flag does not match package-only segments', () => {
    // "example" appears only in the package, not in any simple name
    const results = indexer.searchClass('example', 100, { simpleNameOnly: true });
    expect(results).toHaveLength(0);
  });

  it('--package-only flag matches by package prefix', () => {
    const results = indexer.searchClass('com.example', 100, { packageOnly: true });
    const names = classNames(results);
    expect(names).toContain('com.example.FooBar');
    expect(names).toContain('com.example.BarBaz');
    expect(names).not.toContain('org.test.FooService');
  });

  it('no opts preserves backward compatibility (FTS default)', () => {
    const results = indexer.searchClass('Foo', 100);
    const names = classNames(results);
    expect(names).toContain('com.example.FooBar');
    expect(names).toContain('org.test.FooService');
  });
});
