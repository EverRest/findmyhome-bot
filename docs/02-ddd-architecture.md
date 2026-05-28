# DDD — layers and dependencies

```
presentation  →  application  →  domain  ←  infrastructure
```

**Domain** must not import Nest, Prisma, Gmail, or Telegram.

## Bounded contexts

### `email-ingestion`

- **Domain:** `IncomingEmail`, `GmailPort`, `ListingParserPort`
- **Application:** `FetchAndParseEmailsUseCase`
- **Infrastructure:** `GmailApiAdapter`, parsers, `ParserRegistry`

### `facebook-ingestion`

- **Domain:** `IncomingFacebookPost`, `FacebookGroupsPort`, `FacebookPostParserPort`
- **Application:** `FetchAndParseFacebookPostsUseCase`
- **Infrastructure:** `PlaywrightFacebookGroupsAdapter`, `FacebookRentalPostParser`, `NoopFacebookGroupsAdapter`

### `listing`

- **Domain:** `ListingDraft`, `ListingRepositoryPort`
- **Infrastructure:** `PrismaListingRepository`

### `scoring`

- **Domain:** `ScoreResult`, `RiskLevel`, `geo.utils` (Haversine, distance buckets)
- **Application:** `RuleScorerService`, `ScoreListingsUseCase`, `GeocodeListingService`
- **Infrastructure:** `OllamaAdapter` → `OLLAMA_BASE_URL` on **Mac host**; `NominatimAdapter` → OSM geocoding (see [GEO-SCORING.md](./GEO-SCORING.md))

### `notification`

- **Application:** `SendDigestUseCase`, `formatListingCard`
- **Infrastructure:** `TelegramAdapter` (telegraf library) → group `TELEGRAM_CHAT_IDS`

### `pipeline`

- **Application:** `RunDailyPipelineUseCase` (orchestrator: 1 Gmail → 2 Facebook → 3 score → 4 digest)
- **Presentation:** `PipelineController`, `PipelineCron`

## DI tokens (ports)

| Token                     | Implementation            |
| ------------------------- | ------------------------- |
| `LISTING_REPOSITORY`      | `PrismaListingRepository` |
| `GMAIL_PORT`              | `GmailApiAdapter`         |
| `LISTING_PARSER_REGISTRY` | `ParserRegistry`          |
| `TELEGRAM_PORT`           | `TelegramAdapter`         |

## Extension

New portal → new `ListingParserPort` under `email-ingestion/infrastructure/parsers/`, register in `ParserRegistry`.
