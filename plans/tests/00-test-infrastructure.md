# Test Plan 00 — Test Infrastructure Setup

> **Prerequisite for all other test plans.** Must be completed first.

## Scope

Set up test runners, dependencies, configuration files, and shared test utilities for both backend and frontend.

---

## Backend (bun:test)

### Dependencies to Add

```bash
# apps/api
bun add -d @electric-sql/pglite
```

No other test deps needed — `bun:test` is built-in.

### Configuration

**`apps/api/bunfig.toml`** (create):
```toml
[test]
timeout = 15000
coverage = true
coverageReporter = ["text", "lcov"]
```

**`apps/api/package.json`** — add scripts:
```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage"
  }
}
```

### Shared Test Utilities

**`apps/api/src/test-utils/db.ts`** — In-process PGlite database factory:
- Create a fresh PGlite instance per test suite
- Apply Drizzle schema (push or migrate)
- Export `createTestDb()` function that returns a Drizzle instance
- Export `cleanupDb()` helper that truncates all tables between tests

**`apps/api/src/test-utils/fixtures.ts`** — Shared test data:
- `createTestImage(width?, height?, format?)` — Sharp-generated minimal test images
- `MOCK_IMAGE_TYPES` — subset of seed data for type context
- `MOCK_UPLOAD_RECORD` — a valid `imageUploads` row

**`apps/api/src/test-utils/mocks.ts`** — External service mocks:
- `createMockOpenAI()` — returns a mock OpenAI client with configurable responses
- `createMockAnalysisResult()` — returns a valid `AnalysisResult` object
- `createMockClassificationResult()` — returns a valid classification response

**`apps/api/src/test-utils/app.ts`** — Hono test app factory:
- Export a function that creates the full Hono app with test DB injected
- Allows route-level integration testing via `app.request()`

---

## Frontend (Vitest + React Testing Library)

### Dependencies to Add

```bash
# apps/web
bun add -d vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8
```

### Configuration

**`apps/web/vitest.config.ts`** (create):
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/test/**'],
    },
  },
});
```

**`apps/web/src/test/setup.ts`** (create):
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(() => cleanup());
```

**`apps/web/package.json`** — add scripts:
```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage"
  }
}
```

### Shared Test Utilities

**`apps/web/src/test/query-wrapper.tsx`** — Fresh QueryClient provider per test:
- `createTestQueryClient()` — `retry: false`, `gcTime: 0`
- `createQueryWrapper()` — renders QueryClientProvider around children

**`apps/web/src/test/store-utils.ts`** — Zustand store reset helpers:
- `resetAllStores()` — resets all stores to initial state between tests

**`apps/web/src/test/mocks.ts`** — Mock data:
- `MOCK_IMAGE_TYPES_RESPONSE` — grouped image types response
- `MOCK_COST_RESPONSE` — generation cost matrix response
- `MOCK_UPLOAD_RESPONSE` — upload endpoint response
- `MOCK_ANALYSIS_RESPONSE` — AI analysis response

---

## Verification

After setup, running `bun test` (backend) and `bunx vitest --run` (frontend) should both exit cleanly with 0 tests found (no failures). This confirms the infrastructure is wired correctly.
