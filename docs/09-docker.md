# Docker

## Profile `mac` (recommended)

- Container: NestJS app only
- Ollama: **on Mac** (`brew services start ollama`)
- `OLLAMA_BASE_URL=http://host.docker.internal:11434`

```bash
docker compose --profile mac up -d --build
curl http://localhost:3000/health
```

## Volumes

| Path        | Contents            |
| ----------- | ------------------- |
| `./data`    | SQLite              |
| `./config`  | criteria.yaml       |
| `./secrets` | Gmail refresh token |

## Gmail OAuth

Run **on the host**, not inside the container:

```bash
npm run gmail:auth
```

Token → `./secrets/gmail-token.json` (mounted into the container).
