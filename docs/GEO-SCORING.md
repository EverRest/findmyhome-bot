# Geo scoring (Nominatim + proximity)

Listings can be scored by **straight-line distance** (Haversine) from a reference point in [`config/criteria.yaml`](../config/criteria.yaml). Addresses are geocoded via **[Nominatim](https://nominatim.org/)** (OpenStreetMap). Results are cached in SQLite so repeat lookups do not hit the API.

## Quick setup

1. Set a reference point in `criteria.yaml` → `scoring.referencePoint` (default: Piazza Bernini, Turin).
2. Add to `.env`:

```env
NOMINATIM_USER_AGENT=FindMyHome/1.0 (your-email@example.com)
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
PHOTON_BASE_URL=https://photon.komoot.io
```

Nominatim **requires** a valid User-Agent identifying your app and contact.

3. Run migrations: `npx prisma migrate deploy`
4. Pipeline geocodes on the next **score** step when `lat`/`lng` are missing.

## How it works

```text
locationHint / title  →  GeocodeCache (SQLite)  →  Nominatim (on miss)
                              ↓ (403 / miss)
                         Photon fallback
                              ↓
                         lat/lng on Listing
                              ↓
                    Haversine → distanceToRefM
                              ↓
                    proximityScore 0–10 (buckets)
                              ↓
         RuleScorer bonus + LLM criterion proximityToReference (injected)
                              ↓
         Telegram: 📍 ~650 m from Piazza Bernini (if reference configured)
```

- **Distance** is never guessed by Ollama — the app computes it.
- **`metroLandmark`** LLM criterion was replaced by **`proximityToReference`** (server-side).
- If geocoding fails, `missingScore` (default 5/10) is used; no distance line in Telegram.

## Config reference

```yaml
scoring:
  referencePoint:
    name: Piazza Bernini
    lat: 45.08004414290359
    lng: 7.6444000110148
  geocoding:
    enabled: true
    provider: nominatim
    baseUrl: https://nominatim.openstreetmap.org
    minIntervalMs: 1100 # ~1 request/sec (Nominatim policy)
    fallbackProvider: photon # try Photon when Nominatim blocks or misses
    photonBaseUrl: https://photon.komoot.io
    citySuffix: 'Torino, Italy'
  distanceScore:
    buckets:
      - { maxM: 500, score: 10 }
      - { maxM: 1000, score: 9 }
      # ...
    missingScore: 5
  rulesProximityBonus: 15 # max extra rule points from proximity
```

### Disable proximity

- Remove `referencePoint`, or set `geocoding.enabled: false`.
- No Nominatim calls, no Telegram distance line, proximity criterion omitted.

## Nominatim usage policy

Public instance limits (see [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)):

- **Max ~1 request per second**
- **Valid User-Agent** with contact info
- **Cache** results (this app uses `GeocodeCache` + listing `lat`/`lng`)

For higher volume production, consider:

- Self-hosted Nominatim
- [Photon](https://photon.komoot.io/) (OSM-based, no key; still cache + rate-limit)

## Haversine vs road distance

Scores use **straight-line** meters, not walking/driving time. Road routing (OpenRouteService, etc.) is out of scope for MVP.

## Backfill existing listings

Listings without coordinates are geocoded on the next score run (respects `SCORE_CACHE_DAYS`). To force re-score sooner, bump `lastSeenAt` or wait for cache expiry.

## Troubleshooting

| Symptom                     | Check                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------- |
| No `📍` in Telegram         | `referencePoint` set? `distanceToRefM` populated?                                     |
| All listings `missingScore` | `NOMINATIM_USER_AGENT` set? `fallbackProvider: photon`? Address too vague?            |
| Nominatim HTTP 403          | Normal for bulk use — Photon fallback should kick in; check logs for `source: photon` |
| Slow scoring                | Normal — 1 req/s throttle; cache fills over time                                      |
