# Architecture note — consolidation into maven-index

This repository was consolidated into [`maven-index`](https://github.com/tangcent/maven-index) on 2026-07-07 as part of the engine unification spec (.spec/maven-indexer-redesign/requirements-engine-unification.md).

## What moved where

| Old path (here) | New path (in maven-index) |
|---|---|
| `src/core/` | `packages/engine/src/` |
| `src/commands/` | `packages/cli/src/commands/` |
| `src/cli.ts` | `packages/cli/src/cli.ts` |
| `src/llm_format.ts` | `packages/engine/src/llm_format.ts` |
| `src/output.ts` | `packages/engine/src/output.ts` |
| `src/project_detector.ts` | `packages/engine/src/project_detector.ts` |
| `src/smart_resolver.ts` | `packages/engine/src/smart_resolver.ts` |
| `test/` | (consolidated into `maven-index/test/`) |
| `skills/` | (consolidated into `maven-index/skills/`) |
| `lib/cfr-0.152.jar` | `packages/engine/lib/cfr-0.152.jar` |

## Why?

Two near-identical `indexer.ts` files (CLI's and MCP's) drifted by 374 diff-lines. Every bug fix had to land twice. The unification merges them into one `@maven-indexer/engine` package imported by both faces (CLI + MCP).

See the full spec: [.spec/maven-indexer-redesign/requirements-engine-unification.md](https://github.com/tangcent/maven-index/blob/main/.spec/maven-indexer-redesign/requirements-engine-unification.md)
