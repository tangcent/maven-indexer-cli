import { describe, it, expect } from 'vitest';
import { Artifact } from '../src/core/indexer.js';

/**
 * Tests the quick scan filtering logic:
 * Only one artifact per groupId:artifactId should remain after filtering.
 *
 * We test the filtering logic directly by replicating the algorithm from indexer.ts.
 */
function applyQuickScanFilter(artifacts: Artifact[]): Map<string, Artifact[]> {
  const groups = new Map<string, Artifact[]>();
  for (const art of artifacts) {
    const key = `${art.groupId}:${art.artifactId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(art);
  }
  return groups;
}

function makeArtifact(groupId: string, artifactId: string, version: string): Artifact {
  return { id: 0, groupId, artifactId, version, abspath: `/tmp/${groupId}/${artifactId}/${version}`, hasSource: false };
}

describe('quick scan filtering logic', () => {
  it('groups artifacts by groupId:artifactId key', () => {
    const artifacts: Artifact[] = [
      makeArtifact('com.example', 'demo', '1.0.0'),
      makeArtifact('com.example', 'demo', '2.0.0'),
      makeArtifact('com.example', 'other', '1.0.0'),
    ];

    const groups = applyQuickScanFilter(artifacts);

    expect(groups.size).toBe(2);
    expect(groups.get('com.example:demo')).toHaveLength(2);
    expect(groups.get('com.example:other')).toHaveLength(1);
  });

  it('produces one group per unique groupId:artifactId', () => {
    const artifacts: Artifact[] = [
      makeArtifact('com.example', 'demo', '1.0.0'),
      makeArtifact('com.example', 'demo', '1.1.0'),
      makeArtifact('com.example', 'demo', '2.0.0'),
    ];

    const groups = applyQuickScanFilter(artifacts);

    // All 3 versions map to the same group key
    expect(groups.size).toBe(1);
    expect(groups.get('com.example:demo')).toHaveLength(3);
  });

  it('keeps distinct groups for different artifactIds', () => {
    const artifacts: Artifact[] = [
      makeArtifact('org.springframework', 'spring-core', '5.3.0'),
      makeArtifact('org.springframework', 'spring-core', '6.0.0'),
      makeArtifact('org.springframework', 'spring-web', '5.3.0'),
      makeArtifact('org.springframework', 'spring-web', '6.0.0'),
    ];

    const groups = applyQuickScanFilter(artifacts);

    expect(groups.size).toBe(2);
    expect(groups.get('org.springframework:spring-core')).toHaveLength(2);
    expect(groups.get('org.springframework:spring-web')).toHaveLength(2);
  });

  it('after selecting one winner per group, result has one artifact per groupId:artifactId', () => {
    const artifacts: Artifact[] = [
      makeArtifact('com.example', 'demo', '1.0.0'),
      makeArtifact('com.example', 'demo', '2.0.0'),
      makeArtifact('com.other', 'lib', '3.0.0'),
    ];

    const groups = applyQuickScanFilter(artifacts);

    // Simulate picking one winner per group (e.g., last one)
    const winners: Artifact[] = [];
    for (const candidates of groups.values()) {
      winners.push(candidates[candidates.length - 1]);
    }

    expect(winners).toHaveLength(2);

    // Each groupId:artifactId appears exactly once
    const keys = winners.map(w => `${w.groupId}:${w.artifactId}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(winners.length);
  });
});
