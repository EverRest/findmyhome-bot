# Facebook groups ingestion

Posts from configured Facebook groups are fetched with **Playwright** (saved browser session), parsed, and merged into the same listing pipeline as Gmail.

## Setup

1. Add group IDs to `.env` (numeric ID from `facebook.com/groups/123456789`):

```env
FACEBOOK_INGESTION_ENABLED=true
FACEBOOK_GROUP_IDS=123456789,987654321
FACEBOOK_STORAGE_STATE_PATH=./secrets/facebook-storage.json
FACEBOOK_LOOKBACK_HOURS=24
```

2. One-time login (opens a browser):

```bash
npm run facebook:login
```

3. Restart the app and run pipeline:

```bash
curl -X POST http://localhost:3000/pipeline/run -H "x-api-key: YOUR_KEY"
```

## Student housing filter

Posts matching student-only patterns (e.g. `studenti`, `solo studenti`, `posto letto`, `Erasmus`) are **skipped** and not stored. This matches the family-with-child search in `config/criteria.yaml`.

## Status

```bash
curl http://localhost:3000/pipeline/status | jq '.integrations.facebook'
```

## Graph API (optional)

Usually **not** available for member-only groups:

```bash
FACEBOOK_ACCESS_TOKEN=... FACEBOOK_GROUP_IDS=123 npm run facebook:probe
```

## Notes

- Re-run `facebook:login` if session expires (CAPTCHA / logout).
- Facebook UI changes may require parser updates.
- Scraping may violate Meta ToS; use at your own risk.
