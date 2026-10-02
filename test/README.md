# Tests

## Unit tests (Vitest)

Run with `pnpm test:run` (or `pnpm test` for watch mode).
Config: `vitest.config.ts` (jsdom, globals, alias `@` -> repo root, excludes `test/e2e`).

| File | Module under test |
| --- | --- |
| `test/unit/services/post-service.test.ts` | `lib/services/post-service.ts` |
| `test/unit/lib/utils.test.ts` | `lib/utils.ts` |
| `test/unit/lib/post-helpers.test.ts` | `lib/post-helpers.ts` |
| `test/unit/lib/cache-manager.test.ts` | `lib/cache-manager.ts` |
| `test/unit/lib/retry-utils.test.ts` | `lib/retry-utils.ts` |

Shared setup is `test/setup.ts`; shared mocks live in `test/mocks/`.

## End-to-end tests (Playwright)

Run with `pnpm test:e2e`.
Config: `playwright.config.ts` (`testDir: ./test/e2e`, boots `pnpm dev` on port 3000).

| File | Coverage |
| --- | --- |
| `test/e2e/home.spec.ts` | home page loads (title + non-error response) |

### First run notes

- Install the browser once: `pnpm test:e2e:install`.
- Next dev compiles `/` on demand; the first navigation measured ~77s, so
  `playwright.config.ts` raises `webServer.timeout` (180s) and `timeout` (120s).
  Subsequent runs reuse the cache and are much faster.
