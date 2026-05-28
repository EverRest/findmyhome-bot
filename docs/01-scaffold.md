# Stage 1 — Scaffold + DDD

## `src/` structure (DDD)

```
src/
  shared/              # Prisma, criteria.yaml loader, health
  listing/             # domain + repository port
  email-ingestion/     # Gmail port, parsers, FetchAndParse use case
  facebook-ingestion/  # Playwright group feed, FB post parser (optional)
    scoring/             # RuleScorer + Ollama (host)
  notification/        # Telegram group digest
  pipeline/            # RunDaily orchestrator + cron
```

Details: [02-ddd-architecture.md](./02-ddd-architecture.md).

## Acceptance

- [ ] `npm run build` OK
- [ ] `GET /health` → `{ status: "ok" }`
- [ ] `npx prisma migrate dev` creates SQLite in `./data/`

## Commands

| Command                | Description               |
| ---------------------- | ------------------------- |
| `npm run start:dev`    | Dev server                |
| `npm run gmail:auth`   | OAuth (on host)           |
| `npm run pipeline:dry` | Pipeline without Telegram |
| `npm run lint:fix`     | ESLint + Prettier fix     |
