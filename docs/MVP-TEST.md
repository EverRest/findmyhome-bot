# MVP — test checklist

## 1. One-time setup

```bash
# Ollama on Mac (not in Docker)
ollama serve
ollama pull llama3.2:3b

cp .env.example .env
# Gmail: Google Cloud (project findmyhome-497506)
# 1) APIs & Services → Library → **Gmail API** → Enable
# 2) OAuth **Web application** client, redirect: http://localhost:3333/oauth2callback
# 3) GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET in .env → npm run gmail:auth
npm run gmail:auth

# Telegram group id
TELEGRAM_BOT_TOKEN=... npx ts-node scripts/telegram-get-chat-id.ts
# → TELEGRAM_CHAT_IDS=-100...
```

## 2. Run

```bash
mkdir -p data secrets
# Verbose logs per step:
export LOG_LEVEL=debug
npm run start:dev
```

Look for log prefixes: `[pipeline]`, `[gmail]`, `[parse]`, `[listing]`, `[score]`, `[ollama]`, `[telegram]`.

Integration check:

```bash
curl http://localhost:3000/pipeline/status | jq
```

Expected: `gmail: true`, `telegram: true`, `ollama: true` (when `ollama serve` is running).

## 3. Dry-run (no Telegram posts)

In `.env`:

```env
PIPELINE_DRY_RUN=true
```

```bash
curl -X POST http://localhost:3000/pipeline/dry-run \
  -H "x-api-key: dev-local-key" | jq
```

Inspect `preview` — listing cards with score and zones.

## 4. Live run to Telegram group

```env
PIPELINE_DRY_RUN=false
PIPELINE_CRON_ENABLED=true
```

```bash
curl -X POST http://localhost:3000/pipeline/run \
  -H "x-api-key: dev-local-key"
```

## 5. Turin zones (criteria)

Edit `config/criteria.yaml` → `hard.zones`:

- Cenisia / Cit Turin
- Pozzo Strada
- San Donato
- Piazza Bernini

After changes: `docker compose restart app` or restart `npm run start:dev`.

## 6. Docker

```bash
docker compose --profile mac up -d --build
curl http://localhost:3000/pipeline/status
```

Ollama stays on the host: `OLLAMA_BASE_URL=http://host.docker.internal:11434`.
