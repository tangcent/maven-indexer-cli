import { describe, it, expect, vi, afterEach } from 'vitest';
import { print } from '../src/output.js';
import { Artifact } from '../src/core/indexer.js';

function makeArtifact(groupId: string, artifactId: string, version: string, hasSource = false): Artifact {
  return { id: 1, groupId, artifactId, version, abspath: '/tmp/test', hasSource };
}

describe('output.ts formatters', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('search-classes plain text', () => {
    it('outputs class name and artifact coordinates', () => {
      const output: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((s: any) => { output.push(s); return true; });

      const result = [
        {
          className: 'com.example.MyClass',
          artifacts: [makeArtifact('com.example', 'demo', '1.0.0')],
        },
      ];

      print('search-classes', result, {});

      const text = output.join('');
      expect(text).toContain('Class: com.example.MyClass');
      expect(text).toContain('com.example:demo:1.0.0');
    });

    it('outputs "No classes found." when result is empty', () => {
      const output: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((s: any) => { output.push(s); return true; });

      print('search-classes', [], {});

      expect(output.join('')).toContain('No classes found.');
    });
  });

  describe('search-artifacts plain text', () => {
    it('outputs artifact coordinates with hasSource flag', () => {
      const output: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((s: any) => { output.push(s); return true; });

      const artifacts = [
        makeArtifact('com.example', 'demo', '1.0.0', true),
        makeArtifact('org.other', 'lib', '2.0.0', false),
      ];

      print('search-artifacts', artifacts, {});

      const text = output.join('');
      expect(text).toContain('com.example:demo:1.0.0 (Has Source: true)');
      expect(text).toContain('org.other:lib:2.0.0 (Has Source: false)');
    });

    it('outputs "No artifacts found." when result is empty', () => {
      const output: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((s: any) => { output.push(s); return true; });

      print('search-artifacts', [], {});

      expect(output.join('')).toContain('No artifacts found.');
    });
  });

  describe('JSON mode', () => {
    it('outputs valid JSON for search-classes', () => {
      const output: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((s: any) => { output.push(s); return true; });

      const result = [
        {
          className: 'com.example.MyClass',
          artifacts: [makeArtifact('com.example', 'demo', '1.0.0')],
        },
      ];

      print('search-classes', result, { json: true });

      const text = output.join('');
      expect(() => JSON.parse(text)).not.toThrow();
      const parsed = JSON.parse(text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].className).toBe('com.example.MyClass');
    });

    it('outputs valid JSON for search-artifacts', () => {
      const output: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((s: any) => { output.push(s); return true; });

      const artifacts = [makeArtifact('com.example', 'demo', '1.0.0', true)];

      print('search-artifacts', artifacts, { json: true });

      const text = output.join('');
      expect(() => JSON.parse(text)).not.toThrow();
      const parsed = JSON.parse(text);
      expect(parsed[0].groupId).toBe('com.example');
    });

    it('outputs valid JSON for any command when json: true', () => {
      const output: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((s: any) => { output.push(s); return true; });

      print('get-class', { source: 'public class Foo {}', language: 'java' }, { json: true });

      const text = output.join('');
      expect(() => JSON.parse(text)).not.toThrow();
    });
  });
});
