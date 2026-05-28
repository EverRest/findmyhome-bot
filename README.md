# FindMyHome

Daily listing digest from Gmail (+ optional Facebook groups) → scoring (rules + **Ollama on Mac**) → Telegram **group**.

Architecture: **DDD** (bounded contexts: `email-ingestion`, `facebook-ingestion`, `listing`, `scoring`, `notification`, `pipeline`).

## Quick start (dev)

```bash
cp .env.example .env
mkdir -p data secrets
# Ollama locally (saves RAM in Docker):
brew install ollama && ollama serve
ollama pull llama3.2:3b

npm install
export DATABASE_URL="file:./data/findmyhome.db"
npx prisma migrate dev --name init
npm run start:dev
```

Health: http://localhost:3000/health

## Gmail OAuth (once, on the host)

1. Google Cloud → OAuth Web client → `.env` `GMAIL_CLIENT_ID` / `SECRET`
2. `npm run gmail:auth` → open URL → token saved to `secrets/gmail-token.json`

## Telegram group

1. BotFather → `TELEGRAM_BOT_TOKEN`
2. Create a group and add the bot
3. `TELEGRAM_CHAT_IDS=-100...` (group id)

## Database inspection

```bash
npm run db:inspect              # summary + listings + emails + runs
npm run db:inspect -- --listings   # listing URLs with metadata
npm run db:inspect -- --json       # JSON (export / jq)
```

## Pipeline

```bash
# Dry run (no Telegram posts)
PIPELINE_DRY_RUN=true npm run start:dev
curl -X POST http://localhost:3000/pipeline/run -H "x-api-key: $PIPELINE_API_KEY"
```

Cron: every 3 hours by default (`CRON_EXPRESSION=0 */3 * * *`, `PIPELINE_CRON_ENABLED=true`).

## Lint, types, tests

```bash
npm run lint:fix      # ESLint + Prettier auto-fix
npm run typecheck     # tsc --noEmit
npm run test:cov      # unit tests + coverage HTML/LCOV
npm run coverage:open # open coverage/lcov-report/index.html (macOS)
npm run validate      # lint + typecheck + test:ci (full gate)
```

**Pre-commit** (Husky): lint-staged → typecheck → all unit tests + coverage report.  
Details: [docs/testing.md](docs/testing.md).

## Docker (Ollama on Mac, not in the container)

```bash
docker compose --profile mac up -d --build
```

`OLLAMA_BASE_URL=http://host.docker.internal:11434`

## Documentation

- [docs/00-overview.md](docs/00-overview.md)
- [docs/01-scaffold.md](docs/01-scaffold.md)
- [docs/09-docker.md](docs/09-docker.md)
- [docs/testing.md](docs/testing.md)
- [docs/FACEBOOK-INGESTION.md](docs/FACEBOOK-INGESTION.md) (optional)

## Search criteria (Turin zones)

`config/criteria.yaml` — Cenisia, Cit Turin, Pozzo Strada, San Donato, Piazza Bernini.

Full test checklist: [docs/MVP-TEST.md](docs/MVP-TEST.md).
