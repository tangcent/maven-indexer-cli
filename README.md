# maven-indexer-cli

[![npm version](https://img.shields.io/npm/v/maven-indexer-cli.svg?style=flat)](https://www.npmjs.com/package/maven-indexer-cli)

A command-line tool for querying your local Maven/Gradle artifact index directly from the terminal — no MCP client required.

It shares the same SQLite index as [maven-indexer-mcp](https://github.com/tangcent/maven-indexer-mcp), so if you already use the MCP server, the index is already warm.

**Key Use Case**: When AI tools in the terminal (claude, gemini-cli, kiro-cli, codex, etc.) need to look up Java classes, method signatures, or source code from your local dependencies, they can call `maven-indexer-cli` directly instead of requiring an MCP server.

## Installation

```bash
npm install -g maven-indexer-cli
```

## Skills

```bash
# Install the CLI
npm install -g maven-indexer-cli

# Install the skill
npx skills add tangcent/maven-indexer-cli -g -y
```

The skill guides AI tools to call `maven-indexer-cli` when they need to look up Java classes, artifacts, or source code from your local Maven/Gradle dependencies.

## Quick Start

```bash
# Build the index first (quick scan — one version per artifact)
maven-indexer-cli refresh-index

# Search for a class
maven-indexer-cli search-classes StringUtils

# Get method signatures
maven-indexer-cli get-class com.google.common.collect.ImmutableList
```

## Commands

### `search-classes <query>`

Search for Java classes by name or keyword.

```bash
maven-indexer-cli search-classes StringUtils
maven-indexer-cli search-classes com.google.common.collect.ImmutableList --limit 10
maven-indexer-cli search-classes guava --json
```

Options:
- `--limit <n>` — maximum number of results
- `--json` — output as JSON

### `search-artifacts <query>`

Search for artifacts by groupId, artifactId, or keyword.

```bash
maven-indexer-cli search-artifacts guava
maven-indexer-cli search-artifacts com.google.guava --limit 5
```

### `search-implementations <className>`

Find all implementations of an interface or subclasses of a base class.

```bash
maven-indexer-cli search-implementations java.util.List
maven-indexer-cli search-implementations org.springframework.context.ApplicationListener
```

### `search-resources <pattern>`

Search for non-class resources (proto files, XML configs, etc.) inside JARs.

```bash
maven-indexer-cli search-resources .proto
maven-indexer-cli search-resources log4j.xml
```

### `get-class <className>`

Retrieve method signatures, Javadocs, or full source code for a class.

```bash
# Signatures (default)
maven-indexer-cli get-class com.google.common.collect.ImmutableList

# Javadocs
maven-indexer-cli get-class com.google.common.collect.ImmutableList --type docs

# Full source
maven-indexer-cli get-class com.google.common.collect.ImmutableList --type source

# From a specific artifact
maven-indexer-cli get-class com.google.common.collect.ImmutableList --coordinate com.google.guava:guava:32.1.2-jre
```

Options:
- `--type <signatures|docs|source>` — detail level (default: `signatures`)
- `--coordinate <groupId:artifactId:version>` — resolve from a specific artifact

### `refresh-index`

Rebuild the artifact index.

```bash
# Quick scan (default) — one best version per artifact, fast
maven-indexer-cli refresh-index

# Full scan — all versions of all artifacts
maven-indexer-cli refresh-index --full
```

> **Note**: Query commands (`search-*`, `get-class`) never trigger automatic indexing. If the index is empty they exit immediately with a message telling you to run `refresh-index`. This keeps query latency predictable.

## Configuration

The CLI uses `~/.maven-indexer-mcp/maven-index.sqlite` by default — the same database as the MCP server. Both can run concurrently; the database uses WAL mode for safe concurrent access.

Override the database path with the `DB_FILE` environment variable:

```bash
DB_FILE=/custom/path/maven-index.sqlite maven-indexer-cli search-classes Foo
```

Other environment variables:

| Variable | Description | Default |
|---|---|---|
| `MAVEN_REPO` | Path to local Maven repository | `~/.m2/repository` |
| `GRADLE_REPO_PATH` | Path to Gradle cache | `~/.gradle/caches/modules-2/files-2.1` |
| `INCLUDED_PACKAGES` | Comma-separated package patterns to index | `*` (all) |
| `MAVEN_INDEXER_CFR_PATH` | Path to CFR decompiler JAR | bundled |
| `VERSION_RESOLUTION_STRATEGY` | `semver`, `latest-published`, or `latest-used` | `semver` |

## Smart Class Resolution

When you pass an unqualified class name (e.g., `MyService` instead of `com.example.MyService`), the CLI will:

1. Search your current project directory for `*.java` / `*.kt` files matching that name
2. Extract the package declaration to construct the fully qualified name
3. Trigger a targeted scan of artifacts matching that package prefix
4. Return the result as if you had provided the full name

This works best when run from your project root.

## Development

```bash
git clone git@github.com:tangcent/maven-indexer-cli.git
cd maven-indexer-cli
npm install
npm run build
npm test
```

### Release

```bash
./scripts/release.sh
```

### Publish

```bash
./scripts/publish.sh [npm|github|all]
```

## License

[ISC](LICENSE)
