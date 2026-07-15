# ⚠️ DEPRECATED — This repository has been retired

> **Active development has moved to [`maven-index`](https://github.com/tangcent/maven-index)**
> (formerly `maven-indexer-mcp`, renamed as part of the engine unification)

---

## What happened?

The `maven-indexer-cli` and `maven-indexer-mcp` repositories have been consolidated into a single unified codebase: **[`maven-index`](https://github.com/tangcent/maven-index)**. This repository is now a deprecated stub — all source, tests, and CI have been removed.

## Package vs. Repo — what's still alive?

| | Status |
|---|---|
| **This git repo** (`maven-indexer-cli`) | **Retired** — no active source, no CI/CD, no publishes from here. |
| **`maven-indexer-cli` npm package** | **Still published**, now from [`maven-index/packages/cli`](https://github.com/tangcent/maven-index/tree/main/packages/cli). Existing `npm install -g maven-indexer-cli` and `npx maven-indexer-cli` invocations keep working unchanged. |
| **`maven-indexer-mcp` npm package** | Still published from [`maven-index/packages/mcp`](https://github.com/tangcent/maven-index/tree/main/packages/mcp). |

## Where to go next

- **Source code**: <https://github.com/tangcent/maven-index>
- **CLI package**: [`packages/cli`](https://github.com/tangcent/maven-index/tree/main/packages/cli)
- **MCP package**: [`packages/mcp`](https://github.com/tangcent/maven-index/tree/main/packages/mcp)
- **Shared engine**: [`packages/engine`](https://github.com/tangcent/maven-index/tree/main/packages/engine)
- **Report issues**: <https://github.com/tangcent/maven-index/issues>

## For maintainers

If you arrived here from an old clone, link, or badge:
- The old `maven-indexer-mcp` GitHub URL auto-redirects to `maven-index` (GitHub preserves redirects on rename).
- Re-clone from `https://github.com/tangcent/maven-index.git` to get the unified source.
- Git history of this repo (`maven-indexer-cli`) was preserved via subtree merge into `maven-index/packages/cli/` — prior blame and commit log remain accessible there.
