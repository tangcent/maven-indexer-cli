import fs from 'fs';
import path from 'path';

/**
 * Shared test helpers for creating minimal ZIP/JAR files and .class files
 * without requiring an external Java toolchain.
 */

// ---------------------------------------------------------------------------
// CRC32 (standard polynomial 0xEDB88320, as used by ZIP)
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ---------------------------------------------------------------------------
// ZIP builder (STORED / no compression)
// ---------------------------------------------------------------------------

export interface ZipEntry {
  name: string;
  data: Buffer;
}

export function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralEntries: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf-8');
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Local file header (30 bytes)
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);  // signature
    lfh.writeUInt16LE(20, 4);           // version needed
    lfh.writeUInt16LE(0, 6);            // flags
    lfh.writeUInt16LE(0, 8);            // method: stored
    lfh.writeUInt16LE(0, 10);           // mod time
    lfh.writeUInt16LE(0x21, 12);        // mod date (1980-01-01)
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(size, 18);        // compressed size
    lfh.writeUInt32LE(size, 22);        // uncompressed size
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);           // extra field length

    localParts.push(lfh, nameBuf, entry.data);

    // Central directory header (46 bytes)
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);           // version made by
    cdh.writeUInt16LE(20, 6);           // version needed
    cdh.writeUInt16LE(0, 8);            // flags
    cdh.writeUInt16LE(0, 10);           // method: stored
    cdh.writeUInt16LE(0, 12);           // mod time
    cdh.writeUInt16LE(0x21, 14);        // mod date
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(size, 20);
    cdh.writeUInt32LE(size, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);           // extra field length
    cdh.writeUInt16LE(0, 32);           // comment length
    cdh.writeUInt16LE(0, 34);           // disk number
    cdh.writeUInt16LE(0, 36);           // internal attrs
    cdh.writeUInt32LE(0, 38);           // external attrs
    cdh.writeUInt32LE(offset, 42);      // offset of local header

    centralEntries.push(Buffer.concat([cdh, nameBuf]));

    offset += lfh.length + nameBuf.length + entry.data.length;
  }

  const cdStart = offset;
  const cdBuf = Buffer.concat(centralEntries);
  const cdSize = cdBuf.length;

  // End of central directory (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, cdBuf, eocd]);
}

// ---------------------------------------------------------------------------
// .class file builder (minimal valid JVM class file)
// ---------------------------------------------------------------------------

export interface ClassFileSpec {
  /** Fully qualified internal name with slashes, e.g. "com/example/FooBar" */
  className: string;
  /** Super class internal name (default: "java/lang/Object") */
  superClass?: string;
  /** Interface internal names */
  interfaces?: string[];
  /** Method names (excluding <init>/<clinit>) */
  methods?: string[];
}

export function buildClassFile(spec: ClassFileSpec): Buffer {
  const superClass = spec.superClass ?? 'java/lang/Object';
  const interfaces = spec.interfaces ?? [];
  const methods = spec.methods ?? [];

  const cpEntries: Buffer[] = [];
  const utf8Cache = new Map<string, number>();
  let nextIndex = 1;

  function addUtf8(s: string): number {
    const cached = utf8Cache.get(s);
    if (cached !== undefined) return cached;
    const idx = nextIndex++;
    const sBuf = Buffer.from(s, 'utf-8');
    const entry = Buffer.alloc(3 + sBuf.length);
    entry.writeUInt8(1, 0); // CONSTANT_Utf8
    entry.writeUInt16BE(sBuf.length, 1);
    sBuf.copy(entry, 3);
    cpEntries.push(entry);
    utf8Cache.set(s, idx);
    return idx;
  }

  function addClass(name: string): number {
    const nameIdx = addUtf8(name);
    const idx = nextIndex++;
    const entry = Buffer.alloc(3);
    entry.writeUInt8(7, 0); // CONSTANT_Class
    entry.writeUInt16BE(nameIdx, 1);
    cpEntries.push(entry);
    return idx;
  }

  // Build constant pool: this class, super class, interfaces
  const thisClassIdx = addClass(spec.className);
  const superClassIdx = addClass(superClass);
  const interfaceIndices = interfaces.map(addClass);

  // Method name + descriptor entries
  const methodSpecs = methods.map(name => ({
    nameIdx: addUtf8(name),
    descIdx: addUtf8('()V'),
  }));

  const cpCount = nextIndex; // number of cp entries + 1

  const parts: Buffer[] = [];

  // Magic + version + constant_pool_count
  const header = Buffer.alloc(10);
  header.writeUInt32BE(0xCAFEBABE, 0);
  header.writeUInt16BE(0, 4);   // minor
  header.writeUInt16BE(52, 6);  // major (Java 8)
  header.writeUInt16BE(cpCount, 8);
  parts.push(header);

  // Constant pool entries
  for (const entry of cpEntries) parts.push(entry);

  // access_flags + this_class + super_class + interfaces_count
  const classInfo = Buffer.alloc(8);
  classInfo.writeUInt16BE(0x0001, 0);  // ACC_PUBLIC
  classInfo.writeUInt16BE(thisClassIdx, 2);
  classInfo.writeUInt16BE(superClassIdx, 4);
  classInfo.writeUInt16BE(interfaceIndices.length, 6);
  parts.push(classInfo);

  // interfaces
  for (const ifaceIdx of interfaceIndices) {
    const ibuf = Buffer.alloc(2);
    ibuf.writeUInt16BE(ifaceIdx, 0);
    parts.push(ibuf);
  }

  // fields_count = 0
  const fc = Buffer.alloc(2);
  fc.writeUInt16BE(0, 0);
  parts.push(fc);

  // methods_count + methods
  const mc = Buffer.alloc(2);
  mc.writeUInt16BE(methodSpecs.length, 0);
  parts.push(mc);

  for (const ms of methodSpecs) {
    const m = Buffer.alloc(8);
    m.writeUInt16BE(0x0001, 0);    // ACC_PUBLIC
    m.writeUInt16BE(ms.nameIdx, 2);
    m.writeUInt16BE(ms.descIdx, 4);
    m.writeUInt16BE(0, 6);         // attributes_count = 0
    parts.push(m);
  }

  // class attributes_count = 0
  const cac = Buffer.alloc(2);
  cac.writeUInt16BE(0, 0);
  parts.push(cac);

  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------
// Maven fixture builder
// ---------------------------------------------------------------------------

export interface MavenClassSpec {
  /** Dotted FQN, e.g. "com.example.FooBar" */
  name: string;
  superClass?: string;
  interfaces?: string[];
  methods?: string[];
}

export interface MavenArtifactSpec {
  groupId: string;
  artifactId: string;
  version: string;
  classes?: MavenClassSpec[];
  resources?: { path: string; content: string }[];
  pomContent?: string;
  /** Create an empty (but valid) JAR with no entries */
  emptyJar?: boolean;
  /** Don't create a JAR at all */
  noJar?: boolean;
}

/**
 * Resets the DB, Config, and Indexer singletons so any open SQLite file
 * handles are released before test fixtures are torn down.
 *
 * On Windows, deleting a file that is still open throws EBUSY, so this
 * MUST be awaited before fs.rmSync(tmpDir, ...) in afterEach.
 */
export async function cleanupSingletons(): Promise<void> {
  const { DB } = await import('../src/core/db/index.js');
  const { Config } = await import('../src/core/config.js');
  const { Indexer } = await import('../src/core/indexer.js');
  DB.reset();
  Config.reset();
  (Indexer as any).instance = undefined;
}

/**
 * Creates a Maven-layout artifact in the repo directory.
 * Returns the artifact version directory path.
 */
export function createMavenArtifact(
  repoDir: string,
  spec: MavenArtifactSpec,
): string {
  const groupPath = spec.groupId.split('.').join(path.sep);
  const artifactDir = path.join(repoDir, groupPath, spec.artifactId, spec.version);
  fs.mkdirSync(artifactDir, { recursive: true });

  // POM file
  const pomContent = spec.pomContent ??
    `<project><groupId>${spec.groupId}</groupId><artifactId>${spec.artifactId}</artifactId><version>${spec.version}</version></project>`;
  fs.writeFileSync(
    path.join(artifactDir, `${spec.artifactId}-${spec.version}.pom`),
    pomContent,
  );

  // JAR file
  if (!spec.noJar) {
    const jarPath = path.join(artifactDir, `${spec.artifactId}-${spec.version}.jar`);
    const entries: ZipEntry[] = [];

    for (const cls of spec.classes ?? []) {
      const internalName = cls.name.replace(/\./g, '/');
      const classData = buildClassFile({
        className: internalName,
        superClass: cls.superClass?.replace(/\./g, '/'),
        interfaces: cls.interfaces?.map(i => i.replace(/\./g, '/')),
        methods: cls.methods,
      });
      entries.push({ name: `${internalName}.class`, data: classData });
    }

    for (const res of spec.resources ?? []) {
      entries.push({ name: res.path, data: Buffer.from(res.content, 'utf-8') });
    }

    fs.writeFileSync(jarPath, createZip(entries));
  }

  return artifactDir;
}
