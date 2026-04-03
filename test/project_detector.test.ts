import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { detectDependencies } from '../src/project_detector.js';

describe('project_detector', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-cli-detector-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('pom.xml parsing', () => {
    it('correctly parses a sample pom.xml with 2 dependencies', async () => {
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>my-app</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>5.3.0</version>
    </dependency>
    <dependency>
      <groupId>com.google.guava</groupId>
      <artifactId>guava</artifactId>
      <version>31.0-jre</version>
    </dependency>
  </dependencies>
</project>`;

      fs.writeFileSync(path.join(tmpDir, 'pom.xml'), pomContent);

      const deps = await detectDependencies(tmpDir);

      expect(deps).toHaveLength(2);
      expect(deps[0]).toEqual({
        groupId: 'org.springframework',
        artifactId: 'spring-core',
        version: '5.3.0',
      });
      expect(deps[1]).toEqual({
        groupId: 'com.google.guava',
        artifactId: 'guava',
        version: '31.0-jre',
      });
    });

    it('returns empty array for pom.xml with no dependencies', async () => {
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>my-app</artifactId>
  <version>1.0.0</version>
</project>`;

      fs.writeFileSync(path.join(tmpDir, 'pom.xml'), pomContent);

      const deps = await detectDependencies(tmpDir);
      expect(deps).toHaveLength(0);
    });
  });

  describe('build.gradle parsing', () => {
    it('correctly parses a sample build.gradle with 2 implementation dependencies', async () => {
      const gradleContent = `
plugins {
    id 'java'
}

dependencies {
    implementation 'org.springframework:spring-core:5.3.0'
    implementation 'com.google.guava:guava:31.0-jre'
    testImplementation 'junit:junit:4.13.2'
}
`;

      fs.writeFileSync(path.join(tmpDir, 'build.gradle'), gradleContent);

      const deps = await detectDependencies(tmpDir);

      // Should find all 3 (implementation + testImplementation)
      expect(deps.length).toBeGreaterThanOrEqual(2);

      const springDep = deps.find(d => d.artifactId === 'spring-core');
      expect(springDep).toBeDefined();
      expect(springDep?.groupId).toBe('org.springframework');
      expect(springDep?.version).toBe('5.3.0');

      const guavaDep = deps.find(d => d.artifactId === 'guava');
      expect(guavaDep).toBeDefined();
      expect(guavaDep?.groupId).toBe('com.google.guava');
      expect(guavaDep?.version).toBe('31.0-jre');
    });

    it('correctly parses build.gradle with api and compileOnly dependencies', async () => {
      const gradleContent = `
dependencies {
    api 'com.fasterxml.jackson.core:jackson-databind:2.13.0'
    compileOnly 'org.projectlombok:lombok:1.18.22'
}
`;

      fs.writeFileSync(path.join(tmpDir, 'build.gradle'), gradleContent);

      const deps = await detectDependencies(tmpDir);

      expect(deps).toHaveLength(2);
      expect(deps[0].groupId).toBe('com.fasterxml.jackson.core');
      expect(deps[0].artifactId).toBe('jackson-databind');
      expect(deps[1].groupId).toBe('org.projectlombok');
      expect(deps[1].artifactId).toBe('lombok');
    });
  });

  describe('fallback behavior', () => {
    it('returns empty array when no build files exist', async () => {
      const deps = await detectDependencies(tmpDir);
      expect(deps).toHaveLength(0);
    });
  });
});
