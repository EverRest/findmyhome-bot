# Testing and quality gates

## Commands

| Command                | Description                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `npm test`             | Unit tests (watch-friendly)                                                          |
| `npm run test:cov`     | Unit tests + coverage report                                                         |
| `npm run test:ci`      | CI / pre-commit: coverage + `--ci` (fails on threshold regression)                   |
| `npm run test:e2e`     | E2E (boots full Nest app; not run on pre-commit)                                     |
| `npm run typecheck`    | TypeScript static check (`tsc --noEmit`)                                             |
| `npm run lint`         | ESLint                                                                               |
| `npm run lint:fix`     | ESLint + auto-fix                                                                    |
| `npm run format:check` | Prettier check (no writes)                                                           |
| `npm run validate`     | `lint` + `typecheck` + `test:ci` (same as pre-commit, without lint-staged)           |
| `npm run ci`           | `lint` + `format:check` + `typecheck` + `build` + `test:ci` (matches GitHub Actions) |

## Coverage

Jest writes reports to `coverage/` (gitignored):

- **HTML:** `coverage/lcov-report/index.html` — open with `npm run coverage:open` (macOS)
- **LCOV:** `coverage/lcov.info` — for CI tools (Codecov, Sonar, etc.)
- **JSON:** `coverage/coverage-summary.json` — machine-readable totals

Minimum thresholds in `jest.config.ts` (enforced by `test:ci`):

| Metric     | Threshold | Notes                                                     |
| ---------- | --------- | --------------------------------------------------------- |
| Lines      | 91%       | Raise as new code adds tests                              |
| Functions  | 89%       |                                                           |
| Statements | 90%       | Some `??` / ternary branches count as separate statements |
| Branches   | 77%       | Optional chaining and defensive paths                     |

Current suite: **220+ unit tests** across parsers, use cases, adapters, and modules. E2E (`test:e2e`) is separate and not part of the threshold.

## GitHub Actions

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (no deploy).

On every push/PR to `main` or `master`:

1. **quality** — `npm ci` → Prisma generate → ESLint → Prettier → typecheck → `nest build` → `test:ci` (coverage artifact uploaded)
2. **prisma** — `prisma migrate deploy` on a fresh SQLite file + `prisma validate`

Local equivalent: `npm run ci`

Required secrets: none (integrations mocked/disabled via workflow `env`).

## Pre-commit (Husky)

On every `git commit`:

1. `lint-staged` — ESLint + Prettier on **staged** files only
2. `typecheck` — full project TypeScript check
3. `test:ci` — **all** unit tests + coverage report

E2E is excluded from pre-commit because it starts the full app and may require DB/env.

## Static analysis

- **ESLint** + Prettier — style and many TS rules (`eslint.config.mjs`)
- **TypeScript compiler** — `npm run typecheck` (stricter than ESLint alone)

No separate SonarQube setup; add in CI later if needed.
