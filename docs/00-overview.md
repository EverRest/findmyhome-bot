# FindMyHome — overview

Daily pipeline: **Gmail API** (+ optional **Facebook groups**) → parse → **rules + Ollama (on Mac)** → digest to **Telegram group**.

## DDD (bounded contexts)

| Context              | Responsibility                        |
| -------------------- | ------------------------------------- |
| `email-ingestion`    | Fetch emails, parse HTML              |
| `facebook-ingestion` | Group posts via Playwright (optional) |
| `listing`            | Listing aggregate, dedup, persistence |
| `scoring`            | Criteria, rules, Ollama risk/score    |
| `notification`       | Telegram digest                       |
| `pipeline`           | Orchestration, cron                   |
| `shared`             | Prisma, config, health                |

Layers per context: `domain` → `application` (use cases) → `infrastructure` → `presentation`.

## Quick start

```bash
cp .env.example .env
# Ollama on Mac: ollama serve && ollama pull llama3.2:3b
npm install && npx prisma migrate dev
npm run start:dev
```

Docker (Ollama on the host):

```bash
docker compose --profile mac up -d --build
```

Details: [01-scaffold.md](./01-scaffold.md), [09-docker.md](./09-docker.md).

## Environment

See `.env.example`. Search criteria: `config/criteria.yaml`.
