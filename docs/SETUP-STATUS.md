# Configuration checklist

Run: `curl http://localhost:3000/pipeline/status | jq`

| Integration      | Required for MVP                  |
| ---------------- | --------------------------------- |
| `gmail: true`    | Yes — `npm run gmail:auth`        |
| `telegram: true` | Yes — token + `TELEGRAM_CHAT_IDS` |
| `ollama: true`   | Yes — `ollama serve` on Mac       |

## Local `.env` (not Docker)

```env
DATABASE_URL=file:./data/findmyhome.db
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:latest
```

## Docker `.env`

```env
DATABASE_URL=file:/app/data/findmyhome.db
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

## Telegram queue (optional)

**Inline (default):** `BULLMQ_ENABLED=false` — one `pipeline/run` sends up to `TELEGRAM_MAX_SEND_PER_RUN` cards with sleep between them; the rest wait for the next run.

**BullMQ (recommended for bulk):** jobs are **scheduled ahead** in Redis (`delay: 0, 2500, 5000…` ms) — one `pipeline/run` enqueues all messages; the Nest worker sends on schedule. **No per-minute cron needed.**

### Redis locally

```bash
# Docker (same as compose profile mac)
npm run redis:up

# or Homebrew
brew services start redis
```

```env
BULLMQ_ENABLED=true
REDIS_URL=redis://127.0.0.1:6379
TELEGRAM_SEND_DELAY_MS=2500
```

Restart app after changing env. Check:

```bash
curl http://localhost:3000/pipeline/status | jq '.config.bullmqEnabled, .integrations.redis, .telegramQueue'
# telegramQueue.delayed = scheduled, not yet sent
```

### BullMQ vs cron every minute

|               | Staggered BullMQ         | Cron `* * * * *`     |
| ------------- | ------------------------ | -------------------- |
| Gmail fetch   | Once per pipeline run    | Every minute (heavy) |
| Order         | Header → cards preserved | Harder               |
| After restart | Delays stay in Redis     | Depends on DB state  |
| Ops           | Redis required           | No Redis             |

## AI rating (10 criteria)

Configured in `config/criteria.yaml` → `llmRating` (prompt + 10 criteria × 0–10).

- Each criterion scored 0–10 by Ollama; **composite = sum** (max 100).
- **`proximityToReference`** is computed server-side (Nominatim + Haversine), not by the LLM — see [GEO-SCORING.md](./GEO-SCORING.md).
- Final score: `rulesWeight × rules + llmWeight × composite` (default 30% / 70%).
- Reasons in DB include line like `🤖 AI (72/100): Price 8/10, …`
- Telegram cards show `💡 …` one-sentence tip from `ListingScore.llmSummary` (prompt in `criteria.yaml` → `telegram.aiSuggestion`)
- Requires `OLLAMA_SCORING_ENABLED=true` and `ollama serve`.

Edit the prompt or criterion labels in YAML without code changes.

## Proximity / geocoding (Nominatim)

| Item                                        | Required                                       |
| ------------------------------------------- | ---------------------------------------------- |
| `scoring.referencePoint` in `criteria.yaml` | For distance scoring                           |
| `NOMINATIM_USER_AGENT` in `.env`            | Yes — OSM policy                               |
| `npx prisma migrate deploy`                 | After pull (Listing geo fields + GeocodeCache) |

Details: [GEO-SCORING.md](./GEO-SCORING.md).

## Facebook groups (optional)

See [FACEBOOK-INGESTION.md](./FACEBOOK-INGESTION.md). Enable with `FACEBOOK_INGESTION_ENABLED=true`, set `FACEBOOK_GROUP_IDS`, run `npm run facebook:login` once. Student-only posts are filtered out automatically.

## Scheduled pipeline (cron)

Nest runs the full pipeline on a cron schedule when `PIPELINE_CRON_ENABLED=true` (default in `.env.example`).

```env
PIPELINE_CRON_ENABLED=true
CRON_EXPRESSION=0 */3 * * *
```

Runs at **00:00, 03:00, 06:00, …** (every 3 hours). Change `CRON_EXPRESSION` and restart the app.

Check: `curl http://localhost:3000/pipeline/status | jq '.config.cronEnabled, .config.cronExpression'`

## Pipeline API key

Header must match `.env` `PIPELINE_API_KEY` (default in example: `change-me`).

```bash
curl -X POST http://localhost:3000/pipeline/dry-run -H "x-api-key: change-me"
```
