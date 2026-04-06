# Woli Pixel — Project Guidelines

> **Assistente Inteligente de Validacao de Imagens** — AI-powered image validation, processing, and generation for the Woli EdTech platform.

## Git Policy

- **NEVER commit.** Claude must NEVER run `git commit`, `git add`, or any git write operation. The user will ALWAYS commit manually. No exceptions, no matter what the user asks in a single message — this rule is permanent.

## Project Context

- **Hackathon IA Woli 2026** (01/04-08/04/2026) — 7-day internal hackathon
- **Judging weights:** Relevancia e Impacto (25%) > Uso Efetivo de IA (25%) > Maturidade do Projeto (20%) > Inovacao e Criatividade (15%) > Viabilidade Tecnica (15%)
- **Language:** All user-facing strings in Brazilian Portuguese. Code, comments, and docs in English.
- **Team:** Gabriel (TI dev) + cross-functional partner

## Architecture

```
woli.pixel/
├── apps/
│   ├── api/           # Bun + Hono + Drizzle ORM + PostgreSQL
│   │   └── src/
│   │       ├── db/          # Schema (Drizzle) + seed
│   │       ├── routes/      # Hono route modules
│   │       ├── services/    # Business logic (AI, Sharp, validators)
│   │       └── middleware/
│   └── web/           # React 19 + Vite 6 + TailwindCSS 4
│       └── src/
│           ├── components/  # React components by feature
│           ├── stores/      # Zustand stores (one per domain)
│           └── lib/         # API client, utilities
└── plans/             # Feature design docs
```

**19 image type presets** across 4 categories: Admin/Branding, Content/Workspace, User, Gamification.

**AI pipeline:** gpt-4.1-mini (vision analysis) -> gpt-4.1-nano (classification) -> Sharp (processing).

---

## TDD — Test-Driven Development (MANDATORY)

**Every new feature, bug fix, or code change MUST follow TDD. No exceptions.**

### The Red-Green-Refactor Cycle

1. **RED:** Write a failing test that describes the desired behavior
2. **GREEN:** Write the minimum code to make the test pass
3. **REFACTOR:** Clean up the code while keeping tests green

### What This Means in Practice

- Before writing ANY implementation code, write tests first
- Tests define the contract — implementation fulfills it
- If you cannot write a test for it, you do not understand it well enough to build it
- Coverage is a byproduct, not a goal — focus on behavior coverage, not line coverage

### Backend Testing (bun:test)

```bash
# Run all tests
bun test

# Run specific file
bun test src/services/generation-cost.test.ts

# Watch mode
bun test --watch

# With coverage
bun test --coverage
```

**Test file convention:** `<module>.test.ts` colocated next to the source file.

**Service tests (unit):**
```ts
import { describe, test, expect } from 'bun:test';
import { resolveOpenAISize } from './generation-cost';

describe('resolveOpenAISize', () => {
  test('returns 1024x1024 for square presets', () => {
    expect(resolveOpenAISize(256, 256)).toBe('1024x1024');
  });
  test('returns 1536x1024 for landscape presets', () => {
    expect(resolveOpenAISize(1920, 1080)).toBe('1536x1024');
  });
});
```

**Route tests (integration) — use Hono's `app.request()`:**
```ts
import { describe, test, expect } from 'bun:test';
import app from '../index';

describe('GET /api/v1/generation-cost', () => {
  test('returns cost matrix with 19 presets', async () => {
    const res = await app.request('/api/v1/generation-cost');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.presets).toHaveLength(19);
  });
});
```

**Database tests — use PGlite for in-process PostgreSQL:**
```ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../db/schema';

let db: ReturnType<typeof drizzle>;
beforeAll(async () => {
  const client = new PGlite();
  db = drizzle(client, { schema });
  // Apply migrations
});
afterEach(async () => {
  await db.delete(schema.imageUploads);
});
```

**Sharp tests — create minimal fixtures programmatically:**
```ts
import sharp from 'sharp';

function createTestImage(width = 100, height = 100): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).png().toBuffer();
}
```

**OpenAI tests — NEVER call the real API. Mock the client:**
```ts
import { mock } from 'bun:test';

const mockOpenAI = {
  responses: {
    create: mock(() => Promise.resolve({
      output_text: JSON.stringify({ quality: { score: 8 } }),
    })),
  },
};
```

### Frontend Testing (Vitest + React Testing Library)

```bash
# Run all tests
bunx vitest

# Watch mode
bunx vitest --watch

# Coverage
bunx vitest --coverage
```

**Test file convention:** `<Component>.test.tsx` or `<module>.test.ts` colocated.

**Component tests:**
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';

describe('QualitySelector', () => {
  it('highlights the selected tier', async () => {
    const onSelect = vi.fn();
    render(<QualitySelector selectedTier="medium" onSelect={onSelect} typeKey="favicon" />);
    await userEvent.click(screen.getByText('Alta Qualidade'));
    expect(onSelect).toHaveBeenCalledWith('high');
  });
});
```

**Zustand store tests — no rendering needed:**
```ts
import { useAppStore } from '@/stores/app-store';

beforeEach(() => {
  useAppStore.setState({ step: 'idle', uploadId: null });
});

test('setUpload transitions to uploading', () => {
  useAppStore.getState().setUpload('id-1', mockImage);
  expect(useAppStore.getState().step).toBe('uploading');
});
```

**React Query tests — fresh client per test:**
```ts
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}
```

---

## Backend Best Practices

### Bun.js

- Use `Bun.file()` and `Bun.write()` for file I/O, not `node:fs` (2-3x faster)
- Bun auto-loads `.env` files — do NOT use `dotenv` (note: current `db/index.ts` uses dotenv — should be removed)
- Use `bun:test` for all backend testing — built-in, no extra dependencies
- For CPU-intensive work (Sharp batch processing), consider `Bun.spawn()` or worker threads

### Hono

- **Route organization:** One `Hono()` instance per route file, composed with `app.route()` in `index.ts`
- **Error handling:** Throw `HTTPException` for known errors, let `app.onError` handle the rest
- **Validation:** Use `@hono/zod-validator` with a custom `hook` to format errors consistently (do NOT expose raw ZodError to clients)
- **Testing:** Use `app.request()` — no HTTP server needed
- **Middleware order matters:** Register global middleware (logger, cors) BEFORE route handlers
- Export `typeof app` as `AppType` if ever using Hono RPC client

### Drizzle ORM

- **Schema:** One table per logical entity. Use `uuid` PKs with `defaultRandom()`. Always add `createdAt`/`updatedAt` timestamps with `withTimezone: true`
- **Migrations:** Use `drizzle-kit generate` for migration files. Use `drizzle-kit push` ONLY for rapid local dev. NEVER `push` in CI/production
- **Queries:** Select only needed columns: `db.select({ id, name }).from(table)`. Use prepared statements for hot paths
- **Transactions:** Use `db.transaction()` for multi-step writes. Nested transactions use savepoints
- **Indexes:** Always index foreign keys and status/filter columns. Consider partial indexes for hot queries
- **Relations:** Use `defineRelations()` v2 API for the `db.query` builder
- **Testing:** PGlite for in-process PostgreSQL (no Docker needed in tests)

### Sharp

- **Memory:** Call `sharp.cache(false)` for per-request processing. Set `sharp.concurrency(1)` in constrained environments
- **Pipeline:** Chain operations in a single pipeline — Sharp optimizes execution internally. Use `.clone()` for multiple outputs from one input
- **Validation:** Always call `.metadata()` before processing to validate the image. Check format, dimensions, and pixel count
- **Error handling:** Wrap all Sharp operations in try/catch. Corrupted files can crash the pipeline
- **Batch:** Use `Promise.allSettled()` for batch processing — one failure should not abort the batch
- **Testing:** Create test images with `sharp({ create: { ... } })`, assert on metadata not pixel data

### OpenAI SDK 5.0

- **Structured outputs:** Use `zodTextFormat()` helper with Zod schemas for guaranteed JSON structure. Add `.describe()` to every Zod field
- **Refusal checking:** ALWAYS check `response.output_parsed` before using data — refusals are a valid response state
- **Error handling:** SDK auto-retries on 429, 500+, and connection errors. Catch `OpenAI.RateLimitError` for explicit handling
- **Cost optimization:** Use `gpt-4.1-nano` for text-only classification, `gpt-4.1-mini` for vision. Do NOT re-send images for follow-up text reasoning
- **Testing:** Inject the OpenAI client as a dependency. Mock at the constructor level, never call the real API in tests
- **Logging:** Always log `request_id` from responses/errors for debugging with OpenAI support

### Zod

- **Schema composition:** Define base schemas, derive with `.pick()`, `.omit()`, `.partial()`. Use `.extend()` (not `.merge()`, deprecated in v4)
- **Error formatting:** Always format ZodErrors before sending to clients: `{ path, message }[]`
- **Integration:** Use `drizzle-zod` (`createInsertSchema`) for DB-aligned validation, then layer business rules on top
- **OpenAI integration:** Every field in structured output schemas should have `.describe()` — improves model accuracy
- **Performance:** Define schemas at module level, not inside request handlers. Use `.safeParse()` over `.parse()` on hot paths

---

## Frontend Best Practices

> Detailed frontend guidelines are in `apps/web/CLAUDE.md`. Key rules:

### React 19
- Use `useActionState` for form submissions, `useOptimistic` for instant UI feedback
- Stop manual `React.memo()`/`useMemo()`/`useCallback()` — the React Compiler handles it
- One component per file, named exports, colocate by feature
- Test behavior with RTL + userEvent, never query by class name

### TailwindCSS 4
- CSS-first config via `@theme` — do NOT create `tailwind.config.js`
- Use `cn()` (clsx + tailwind-merge) for conditional classes
- Use CVA (class-variance-authority) for component variants
- Mobile-first: base styles are mobile, add breakpoint prefixes for larger screens

### Zustand 5
- One store per domain (app, batch, brand, audit, gate, theme)
- Always use atomic selectors: `useStore(s => s.field)`, not `useStore()`
- Use `useShallow` for multi-field selectors
- Zustand = client state. TanStack Query = server state. Do not mix
- Test stores directly with `getState()`/`setState()`, no rendering needed

### TanStack React Query 5
- Query keys are hierarchical arrays: `['images', 'detail', id]`
- Use `queryOptions()` to colocate key + fn
- Set sensible `staleTime` (not 0 everywhere) — static data: 5min, dynamic: 30s
- Always `invalidateQueries` in mutation `onSettled`
- Fresh `QueryClient` per test, `retry: false` in test config

### TypeScript 5.7
- `strict: true` with `noUncheckedIndexedAccess` enabled
- Discriminated unions for state machines, branded types for IDs
- `as const` objects instead of enums
- Use `satisfies` to validate shapes without widening types
- `import type` for type-only imports (enforced by `verbatimModuleSyntax`)

---

## Code Style

### File Naming
- Components: `PascalCase.tsx` (e.g., `QualitySelector.tsx`)
- Services/utils: `kebab-case.ts` (e.g., `generation-cost.ts`)
- Stores: `kebab-case.ts` prefixed with domain (e.g., `app-store.ts`)
- Tests: `<source-file>.test.ts(x)` colocated next to source
- Routes: `kebab-case.ts` matching the URL segment (e.g., `generation-cost.ts` -> `/generation-cost`)

### Import Order
```ts
// 1. React / framework
import { useState } from 'react';
// 2. External libraries
import { useQuery } from '@tanstack/react-query';
// 3. Internal aliases (@/)
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
// 4. Relative imports
import { QualitySelector } from './QualitySelector';
// 5. Types (always last)
import type { QualityTier } from './QualitySelector';
```

### API Response Format
```ts
// Success
{ data: T }
// or direct object for simple responses

// Error
{ error: string }
// or with details
{ error: string, details: { path: string, message: string }[] }
```

### Database Conventions
- Table names: `snake_case` plural (e.g., `image_types`, `batch_jobs`)
- Column names: `snake_case` (e.g., `type_key`, `created_at`)
- TypeScript property names: `camelCase` (Drizzle maps automatically)
- All timestamps: `withTimezone: true`
- All text arrays: `text('col').array()`

---

## Environment

```bash
# Backend
PORT=3000
DATABASE_URL=postgresql://woli:woli_pixel_2026@localhost:5433/woli_pixel
OPENAI_API_KEY=sk-proj-...
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10

# Frontend
VITE_API_URL=http://localhost:3000/api/v1
```

## Scripts

```bash
# Backend (apps/api)
bun run dev              # Dev server with watch
bun run db:generate      # Generate migration
bun run db:push          # Push schema (dev only)
bun run db:seed          # Seed 19 image types
bun test                 # Run tests

# Frontend (apps/web)
bun run dev              # Vite dev server
bun run build            # Production build
bunx vitest              # Run tests
```

## Key Decisions Log

- **Bun over Node:** Faster runtime, built-in test runner, native TypeScript
- **Hono over Express:** Type-safe, WebStandard API, lighter footprint
- **Drizzle over Prisma:** SQL-first, no code generation step, better type inference
- **Zustand over Redux:** Minimal boilerplate, no provider wrapping, simpler mental model
- **gpt-4.1-mini + gpt-4.1-nano:** Two-model pipeline — vision model for analysis, text model for classification (cost optimization)
- **gpt-image-1-mini for generation:** 3 quality tiers (low/medium/high), 2 output sizes (1024x1024, 1536x1024), Sharp handles final resize
