# Project: C9MYR Employee Hub

Internal engagement app for C9MYR employees: goals, social posts, challenges (the "Battle Arena" / PK system), Hall of Fame, team status, and admin-preview voice channels. The same code also runs as a second brand, C6, with its own database.

- Main app: `artifacts/engagement-hub` (React, Vite, Tailwind, Supabase)
- Database: Supabase migrations in `artifacts/engagement-hub/supabase/migrations`
- Hosting: Cloudflare Workers, redeployed on every push to `main`
- PK system spec: `docs/PK-SYSTEM.md`

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
