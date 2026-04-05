# Frontend Best Practices — woli.pixel Web App

> Stack: React 19 + Vite 6 + TailwindCSS 4 + Zustand 5 + TanStack React Query 5 + TypeScript 5.7

---

## 1. React 19

### Key Conventions and Patterns

#### Server-Aware Component Architecture
- Default to **client components** in this Vite SPA — React Server Components require a framework like Next.js. Be aware of RSC patterns for future migration but do not use `"use server"` directives in this codebase.
- Use `React.lazy()` + `<Suspense>` for route-level code splitting:
```tsx
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
```

#### New Hooks — Adopt These

**`use()` hook** — Read context conditionally and resolve promises within Suspense:
```tsx
import { use, Suspense } from 'react';

// Conditional context (impossible with useContext)
function ConditionalTheme({ showTheme }: { showTheme: boolean }) {
  if (showTheme) {
    const theme = use(ThemeContext);
    return <div className={theme}>Themed content</div>;
  }
  return null;
}

// Promise resolution with Suspense
function DataComponent({ dataPromise }: { dataPromise: Promise<Data> }) {
  const data = use(dataPromise);
  return <div>{data.name}</div>;
}
```

**`useActionState`** — Replace manual `useState` + `onSubmit` + `isPending` patterns:
```tsx
import { useActionState } from 'react';

function CreateForm() {
  const [state, formAction, isPending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      try {
        const result = await api.create(Object.fromEntries(formData));
        return { success: true, data: result, error: null };
      } catch (e) {
        return { ...prevState, error: (e as Error).message };
      }
    },
    { success: false, data: null, error: null }
  );

  return (
    <form action={formAction}>
      <input name="title" required />
      <button disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
      {state.error && <p className="text-red-500">{state.error}</p>}
    </form>
  );
}
```

**`useOptimistic`** — Instant UI feedback before server confirmation:
```tsx
import { useOptimistic } from 'react';

function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimistic] = useOptimistic(
    todos,
    (current, newTodo: Todo) => [...current, newTodo]
  );

  async function addTodo(formData: FormData) {
    const tempTodo = { id: crypto.randomUUID(), title: formData.get('title') as string };
    addOptimistic(tempTodo); // Instant UI update
    await api.todos.create(tempTodo); // Reverts automatically on error
  }

  return (
    <form action={addTodo}>
      <input name="title" />
      <ul>{optimisticTodos.map(t => <li key={t.id}>{t.title}</li>)}</ul>
    </form>
  );
}
```

**`useFormStatus`** — Access parent form state from child components:
```tsx
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus(); // Must be CHILD of <form>
  return <button disabled={pending}>{pending ? 'Submitting...' : 'Submit'}</button>;
}
```

#### React Compiler Awareness
- The React Compiler (React Forget) auto-memoizes components and hooks. **Stop adding** `React.memo()`, `useMemo()`, `useCallback()` for render optimization by default.
- Only use manual memoization when profiling proves a specific bottleneck.
- Keep components small and focused to maximize compiler efficiency.

#### Component Patterns
- **One component per file**. Named exports, not default exports:
```tsx
// Good
export function UserCard({ user }: UserCardProps) { ... }

// Avoid
export default function UserCard() { ... }
```
- **Custom hooks for reusable logic** — prefix with `use`, colocate in `hooks/` or next to the feature:
```tsx
export function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() => setValue(v => !v), []);
  return [value, toggle] as const;
}
```
- **Colocation**: Keep components, hooks, types, and tests together by feature, not by type.

### Common Pitfalls
- **Over-lifting state**: Store state in the nearest component that needs it. Lifting to a parent triggers re-renders in all children.
- **Context for frequently-changing data**: Context updates re-render ALL consumers. Use Zustand for high-frequency updates (timers, form inputs, scroll position).
- **Mixing `use()` with `useEffect` for data**: Prefer `use()` + Suspense for promise-based data. Reserve `useEffect` for side effects (event listeners, DOM manipulation), not data fetching.
- **Forgetting Suspense boundaries**: Every `React.lazy()` and `use(promise)` call needs a `<Suspense>` ancestor with a meaningful fallback.

### Testing — Vitest + React Testing Library
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';

describe('UserCard', () => {
  it('displays user name and handles click', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<UserCard user={{ name: 'Gabriel' }} onEdit={onEdit} />);

    expect(screen.getByText('Gabriel')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
```
- **Test behavior, not implementation** — query by role, text, label. Never query by class name or test ID unless no accessible alternative exists.
- **Use `userEvent` over `fireEvent`** — it simulates real user interactions (focus, keyboard, pointer).
- **Fresh setup per test** — use `beforeEach` for cleanup, never share mutable state between tests.
- **Async-first** — always use `await` with `userEvent` and `waitFor` for async state changes.

### Performance Considerations
- Use `startTransition` for non-urgent state updates (search filters, tab switches):
```tsx
import { startTransition } from 'react';
startTransition(() => setSearchResults(filtered));
```
- Code-split routes with `React.lazy()`.
- Profile with React DevTools Profiler, not guesswork.
- Avoid inline object/array creation in JSX props when the React Compiler is not enabled.

---

## 2. Vite 6

### Key Conventions and Patterns

#### Project Configuration
```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'query-vendor': ['@tanstack/react-query'],
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query', 'zustand'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

#### Plugin Recommendations
- **`@vitejs/plugin-react`** — standard React support (used in this project). Consider `@vitejs/plugin-react-swc` for faster dev builds if cold starts become slow.
- **`@tailwindcss/vite`** — native Tailwind v4 integration (already configured). Do NOT use PostCSS-based Tailwind alongside this.
- **`rollup-plugin-visualizer`** — add for bundle analysis during optimization:
```ts
import { visualizer } from 'rollup-plugin-visualizer';
// Add to plugins array for production analysis only
plugins: [
  visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true }),
],
```

#### Environment Variables
- Prefix client-exposed variables with `VITE_`:
```env
VITE_API_URL=https://api.woli.com
VITE_APP_VERSION=1.0.0
```
- Access via `import.meta.env.VITE_API_URL`.
- **Never** expose secrets (API keys, tokens) in `VITE_` variables — they are embedded in the client bundle.
- Use `.env.local` for local overrides (gitignored). Use `.env.production` for production defaults.
- Type environment variables:
```ts
// src/vite-env.d.ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_VERSION: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

#### Tree Shaking
- Always use named imports: `import { debounce } from 'lodash-es'` not `import _ from 'lodash'`.
- Use ESM-compatible libraries (`lodash-es`, `date-fns`, not `moment`).
- Mark side-effect-free modules in `package.json`: `"sideEffects": false`.

### Common Pitfalls
- **Creating `QueryClient` at module level in test files** — instantiate per test (see React Query section).
- **Large `optimizeDeps.include`** — only pre-bundle deps that cause slow page loads, not everything.
- **Forgetting `build.sourcemap`** — always enable for production debugging; disable only if bundle size is critical.
- **Proxy configuration only applies in dev** — production requires actual server/CDN routing.

### Testing — Vitest Integration
```ts
// vitest.config.ts (or inline in vite.config.ts)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/test/**'],
    },
  },
});
```
```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

### Performance Considerations
- Use **dynamic `import()`** for route-level code splitting — Vite handles chunk generation automatically.
- Enable `build.cssCodeSplit: true` (default) to load CSS per-chunk.
- Analyze bundle with `rollup-plugin-visualizer` before optimizing — measure, do not guess.
- Pre-bundle frequently used deps in `optimizeDeps.include` for faster cold starts.

---

## 3. TailwindCSS 4

### Key Conventions and Patterns

#### CSS-First Configuration (v4 Paradigm Shift)
Tailwind v4 replaces `tailwind.config.js` with CSS-native `@theme` directives. All design tokens live in CSS.

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  /* Color System — semantic tokens */
  --color-primary: oklch(0.55 0.2 260);
  --color-primary-light: oklch(0.70 0.15 260);
  --color-primary-dark: oklch(0.40 0.2 260);
  --color-secondary: oklch(0.65 0.18 150);
  --color-danger: oklch(0.55 0.22 25);
  --color-warning: oklch(0.75 0.15 85);
  --color-success: oklch(0.65 0.19 155);

  --color-surface: oklch(0.99 0 0);
  --color-surface-muted: oklch(0.96 0 0);
  --color-border: oklch(0.90 0 0);
  --color-text: oklch(0.15 0 0);
  --color-text-muted: oklch(0.45 0 0);

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing scale override (if needed) */
  --spacing: 0.25rem; /* base unit: 1 = 0.25rem */

  /* Border radius tokens */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* Custom breakpoint */
  --breakpoint-3xl: 120rem;

  /* Animations */
  --animate-fade-in: fade-in 0.2s ease-out;

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
}
```

Every `@theme` variable auto-generates utility classes: `--color-primary` produces `bg-primary`, `text-primary`, `border-primary`, etc.

#### Dark Mode with CSS Variables
```css
/* Define dark overrides using @custom-variant or class-based toggle */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-surface: oklch(0.99 0 0);
  --color-text: oklch(0.15 0 0);
}

/* Override in dark mode using regular CSS */
.dark {
  --color-surface: oklch(0.12 0 0);
  --color-text: oklch(0.92 0 0);
  --color-surface-muted: oklch(0.18 0 0);
  --color-border: oklch(0.25 0 0);
  --color-text-muted: oklch(0.65 0 0);
}
```

Toggle via JS:
```ts
// Toggle dark mode class on <html>
document.documentElement.classList.toggle('dark');
// Persist preference
localStorage.setItem('theme', isDark ? 'dark' : 'light');
```

#### Class Organization — The `cn()` Utility
Always use a `cn()` utility combining `clsx` + `tailwind-merge` to handle conditional and conflicting classes:
```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
Usage:
```tsx
<div className={cn(
  'rounded-lg border p-4',
  isActive && 'border-primary bg-primary/10',
  isDisabled && 'opacity-50 cursor-not-allowed',
  className // allow parent override
)} />
```

#### Component Variants with CVA
For components with multiple visual variants, use CVA (Class Variance Authority):
```tsx
// src/components/ui/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-dark',
        secondary: 'bg-surface border border-border hover:bg-surface-muted',
        danger: 'bg-danger text-white hover:bg-danger/90',
        ghost: 'hover:bg-surface-muted',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
```

#### Responsive Design — Mobile-First
```tsx
{/* Mobile-first: base styles are mobile, then scale up */}
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```
- Always start from mobile, add breakpoint prefixes for larger screens.
- Use Tailwind's built-in breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px), `2xl` (1536px).
- Avoid custom media queries — define custom breakpoints in `@theme` if needed.

### Common Pitfalls
- **Do NOT use `@apply` in v4** — it is deprecated in favor of direct CSS properties or component extraction with CVA.
- **Do NOT create a `tailwind.config.js`** — v4 uses CSS-first configuration via `@theme`.
- **Overly long class strings** — if a single element has more than ~12 utility classes, extract into a CVA variant or CSS component class.
- **Forgetting `tailwind-merge`** — without `twMerge`, conflicting classes like `p-2 p-4` are both applied instead of the last one winning.
- **Color contrast in dark mode** — verify WCAG AA (4.5:1 for text). Dark mode is not just "invert colors."

### Testing
- Visual regression testing with tools like Playwright screenshots or Storybook + Chromatic.
- Toggle `prefers-color-scheme` in browser DevTools to test dark mode without changing system settings.
- Test responsive layouts by setting viewport sizes in test configuration.

### Performance Considerations
- Tailwind v4 with the Vite plugin is extremely fast: incremental builds complete in microseconds.
- Avoid dynamic class construction with string interpolation — Tailwind cannot detect `bg-${color}-500`. Use complete class names or CSS variables instead.
- Use the `cn()` utility to keep class merging efficient and conflict-free.

---

## 4. Zustand 5

### Key Conventions and Patterns

#### Store Design — One Store Per Domain
Organize stores by feature domain, one file per store:
```
src/
  stores/
    useAuthStore.ts        # Authentication state
    useImageStore.ts       # Image upload/validation state
    useUIStore.ts          # UI state (modals, toasts, sidebar)
```

#### Store Structure — Separate State from Actions
```ts
// src/stores/useAuthStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AuthState {
  // State
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;

  // Actions (named as events, not setters)
  login: (credentials: LoginPayload) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        token: null,
        user: null,
        isAuthenticated: false,

        // Actions
        login: async (credentials) => {
          const { token, user } = await api.auth.login(credentials);
          set({ token, user, isAuthenticated: true }, false, 'auth/login');
        },

        logout: () => {
          set({ token: null, user: null, isAuthenticated: false }, false, 'auth/logout');
        },

        refreshToken: async () => {
          const currentToken = get().token;
          if (!currentToken) return;
          const { token } = await api.auth.refresh(currentToken);
          set({ token }, false, 'auth/refreshToken');
        },
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({ token: state.token }), // Only persist token
      }
    ),
    { name: 'AuthStore' }
  )
);
```

#### Selectors — Always Subscribe Selectively
```tsx
// GOOD: Subscribe to specific values
const token = useAuthStore((state) => state.token);
const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

// GOOD: Multiple values with useShallow
import { useShallow } from 'zustand/react/shallow';
const { user, isAuthenticated } = useAuthStore(
  useShallow((state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }))
);

// BAD: Subscribes to entire store — re-renders on ANY change
const store = useAuthStore();
```

#### Derived/Computed Values
Derive values in selectors, do not store computed data:
```ts
// GOOD: Computed in selector
const fullName = useUserStore((state) => `${state.firstName} ${state.lastName}`);

// BAD: Stored redundantly
set({ firstName, lastName, fullName: `${firstName} ${lastName}` });
```

#### Slices Pattern for Complex Stores
When a store grows beyond ~10 state properties, split into slices:
```ts
import { type StateCreator } from 'zustand';

interface ImageSlice {
  images: Image[];
  addImage: (img: Image) => void;
  removeImage: (id: string) => void;
}

interface ValidationSlice {
  validationResults: Map<string, ValidationResult>;
  validate: (imageId: string) => Promise<void>;
}

type CombinedStore = ImageSlice & ValidationSlice;

const createImageSlice: StateCreator<CombinedStore, [], [], ImageSlice> = (set) => ({
  images: [],
  addImage: (img) => set((s) => ({ images: [...s.images, img] })),
  removeImage: (id) => set((s) => ({ images: s.images.filter(i => i.id !== id) })),
});

const createValidationSlice: StateCreator<CombinedStore, [], [], ValidationSlice> = (set, get) => ({
  validationResults: new Map(),
  validate: async (imageId) => {
    const result = await api.validate(imageId);
    set((s) => {
      const updated = new Map(s.validationResults);
      updated.set(imageId, result);
      return { validationResults: updated };
    });
  },
});

export const useWorkspaceStore = create<CombinedStore>()((...a) => ({
  ...createImageSlice(...a),
  ...createValidationSlice(...a),
}));
```

#### Middleware Stack
Standard middleware order: `devtools` wraps `persist` wraps store creator:
```ts
create<MyState>()(
  devtools(
    persist(
      (set, get) => ({ ... }),
      { name: 'store-key', partialize: (s) => ({ ... }) }
    ),
    { name: 'StoreName' }
  )
);
```
- **`devtools`**: Always enable — connects to Redux DevTools. The third argument to `set()` is the action name.
- **`persist`**: Use `partialize` to persist only what is necessary (not loading flags, not derived data).
- **`subscribeWithSelector`**: Use when you need fine-grained external subscriptions.

### Common Pitfalls
- **Direct state mutation**: Always use `set()`. Never mutate state objects directly.
- **Creating stores inside components**: Store creation must be at module level, never inside a render function.
- **Storing server data in Zustand**: Use TanStack Query for server state. Zustand is for client-only state (UI state, form drafts, user preferences).
- **Over-using global state**: Not everything needs a store. Prefer local `useState` for component-specific state.
- **Shallow vs deep comparison**: `useShallow` does shallow comparison. For nested objects, consider splitting state or using individual selectors.

### Testing Zustand Stores
```ts
// Direct store testing (no React needed)
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  });

  it('sets authenticated state on login', async () => {
    await useAuthStore.getState().login({ email: 'test@woli.com', password: 'pass' });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBeDefined();
    expect(state.user).toBeDefined();
  });

  it('clears state on logout', () => {
    useAuthStore.setState({ token: 'abc', isAuthenticated: true });
    useAuthStore.getState().logout();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
```
- Test stores **directly** using `getState()` and `setState()` — no rendering needed.
- Reset store state in `beforeEach` to isolate tests.
- Mock API calls at the network level (MSW) or with `vi.mock()`.

### Performance Considerations
- Atomic selectors prevent unnecessary re-renders — subscribe to the smallest slice of state possible.
- Batch multiple `set()` calls into one when updating related state:
```ts
set({ loading: false, data: result, error: null }); // Single update, single re-render
```
- Flat state structures outperform deeply nested ones.

---

## 5. TanStack React Query 5

### Key Conventions and Patterns

#### Query Key Convention — Hierarchical Arrays
```ts
// src/lib/queryKeys.ts
export const queryKeys = {
  images: {
    all: ['images'] as const,
    lists: () => [...queryKeys.images.all, 'list'] as const,
    list: (filters: ImageFilters) => [...queryKeys.images.lists(), filters] as const,
    details: () => [...queryKeys.images.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.images.details(), id] as const,
    validation: (id: string) => [...queryKeys.images.all, 'validation', id] as const,
  },
  users: {
    all: ['users'] as const,
    me: () => [...queryKeys.users.all, 'me'] as const,
    detail: (id: string) => [...queryKeys.users.all, id] as const,
  },
} as const;
```
- Keys are **arrays** — always.
- Hierarchical structure enables granular invalidation: `invalidateQueries({ queryKey: queryKeys.images.all })` invalidates all image-related queries.
- Include all variables the query depends on (IDs, filters, pagination).

#### queryOptions Pattern (v5)
Colocate `queryKey` and `queryFn` in a single object for type safety and reuse:
```ts
// src/queries/imageQueries.ts
import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export function imageDetailOptions(id: string) {
  return queryOptions({
    queryKey: queryKeys.images.detail(id),
    queryFn: () => api.images.getById(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function imageListOptions(filters: ImageFilters) {
  return queryOptions({
    queryKey: queryKeys.images.list(filters),
    queryFn: () => api.images.list(filters),
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: keepPreviousData,
  });
}

// Usage in components
function ImageDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery(imageDetailOptions(id));
  // ...
}
```

#### QueryClient Configuration
```ts
// src/lib/queryClient.ts — module-level singleton
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,         // 1 minute default
      gcTime: 5 * 60 * 1000,        // 5 minutes garbage collection
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: 'always',
      throwOnError: false,           // Handle errors per-query, not globally
    },
    mutations: {
      retry: 0,                      // Do not retry mutations by default
      throwOnError: false,
    },
  },
});
```
- **Create QueryClient at module level**, never inside a component.
- Set sensible `staleTime` defaults — 0 means "always stale" (the default), which causes refetch on every mount.

#### Mutations with Optimistic Updates (Cache-Based)
```ts
// src/queries/imageMutations.ts
export function useUpdateImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: string; title: string }) =>
      api.images.update(data.id, { title: data.title }),

    onMutate: async (newData) => {
      // 1. Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.images.detail(newData.id) });

      // 2. Snapshot previous value
      const previous = queryClient.getQueryData(queryKeys.images.detail(newData.id));

      // 3. Optimistically update cache
      queryClient.setQueryData(queryKeys.images.detail(newData.id), (old: Image) => ({
        ...old,
        title: newData.title,
      }));

      // 4. Return rollback context
      return { previous };
    },

    onError: (_err, newData, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.images.detail(newData.id), context.previous);
      }
    },

    onSettled: (_data, _error, variables) => {
      // Always refetch after mutation to sync with server
      queryClient.invalidateQueries({ queryKey: queryKeys.images.detail(variables.id) });
    },
  });
}
```

#### Error Handling Pattern
```tsx
function ImageGallery() {
  const { data, error, isLoading, isError, refetch } = useQuery(imageListOptions(filters));

  if (isLoading) return <GallerySkeleton />;

  if (isError) {
    return (
      <ErrorState
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  return <Gallery images={data} />;
}
```
- Handle `isLoading`, `isError`, and success states explicitly.
- Use `error.message` for display — React Query preserves the thrown error.
- Provide retry affordances to the user on error states.
- Use `throwOnError: true` per-query combined with Error Boundaries for critical queries.

#### Dependent Queries
```ts
const { data: user } = useQuery(userOptions());
const { data: images } = useQuery({
  ...imageListOptions({ userId: user?.id ?? '' }),
  enabled: !!user?.id, // Only fetch when user is loaded
});
```

### Common Pitfalls
- **Not invalidating after mutations**: Always call `invalidateQueries` in `onSettled` (not just `onSuccess`) to sync with server.
- **Creating QueryClient inside a component**: Causes a new client every render, losing all cache. Always module-level.
- **`staleTime: 0` everywhere**: This is the default and causes refetches on every component mount. Set appropriate `staleTime` per resource.
- **Using React Query for client-only state**: It is a server state manager. Use Zustand for client state (UI preferences, form drafts).
- **Forgetting `enabled` for dependent queries**: Without it, queries fire immediately with undefined parameters.

### Testing React Query
```ts
// src/test/queryWrapper.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function createQueryWrapper() {
  const client = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

// Usage in tests
import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@/test/queryWrapper';

describe('useImageDetail', () => {
  it('fetches image data', async () => {
    // MSW handler already set up to return mock image data
    const { result } = renderHook(
      () => useQuery(imageDetailOptions('img-123')),
      { wrapper: createQueryWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('img-123');
  });
});
```
- **Fresh QueryClient per test** — never share between tests.
- **Set `retry: false`** in test QueryClient — prevents test timeouts from retry backoff.
- **Use MSW for API mocking** — mock at the network level, not `queryFn`.
- **Always `await waitFor`** for async assertions.

### Performance Considerations
- Set `staleTime` based on data volatility: static data (5+ min), user-specific data (1 min), real-time data (0).
- Use `placeholderData: keepPreviousData` for paginated queries to avoid loading flashes.
- Use `select` to transform/filter data — prevents downstream re-renders when raw data changes but selected data does not.
- Prefetch data on hover/focus for instant perceived navigation:
```ts
queryClient.prefetchQuery(imageDetailOptions(hoveredId));
```

---

## 6. TypeScript 5.7

### Key Conventions and Patterns

#### Strict Configuration (tsconfig.json)
```jsonc
{
  "compilerOptions": {
    "strict": true,                    // Enables all strict checks
    "noUncheckedIndexedAccess": true,  // Array/object index returns T | undefined
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true, // Distinguishes undefined from missing
    "noUncheckedSideEffectImports": true, // TS 5.6+ — validates side-effect imports
    "verbatimModuleSyntax": true        // Enforces explicit type-only imports
  }
}
```

#### Discriminated Unions — Model State Machines
Use a literal discriminator field for type narrowing:
```ts
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

function renderState<T>(state: AsyncState<T>) {
  switch (state.status) {
    case 'idle':    return null;
    case 'loading': return <Spinner />;
    case 'success': return <DataView data={state.data} />;  // TS knows `data` exists
    case 'error':   return <ErrorView error={state.error} />;
    default:        return exhaustive(state); // Compile-time exhaustiveness check
  }
}

// Exhaustiveness helper — errors if any case is unhandled
function exhaustive(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
```

#### Branded Types — Prevent ID Mix-ups
```ts
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

type UserId = Brand<string, 'UserId'>;
type ImageId = Brand<string, 'ImageId'>;
type ValidationId = Brand<string, 'ValidationId'>;

// Constructor functions
function UserId(id: string): UserId { return id as UserId; }
function ImageId(id: string): ImageId { return id as ImageId; }

// Prevents accidental swaps at compile time
function getImage(id: ImageId): Promise<Image> { ... }

getImage(UserId('abc'));  // TS Error: UserId not assignable to ImageId
getImage(ImageId('abc')); // OK
```

#### Generic Patterns
```ts
// Constrained generics — prevent overly permissive types
function getProperty<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  key: K
): T[K] {
  return obj[key];
}

// Factory pattern with inference
function createStore<T extends Record<string, unknown>>(
  initialState: T
) {
  let state = { ...initialState };
  return {
    get: <K extends keyof T>(key: K): T[K] => state[key],
    set: <K extends keyof T>(key: K, value: T[K]) => { state[key] = value; },
  };
}
// Type is fully inferred: createStore({ count: 0 }).get('count') returns number
```

#### `satisfies` Operator — Validate Without Widening
```ts
type RouteConfig = Record<string, { path: string; requiredAuth: boolean }>;

// `satisfies` ensures the shape is correct but preserves literal types
const routes = {
  home:      { path: '/',          requiredAuth: false },
  dashboard: { path: '/dashboard', requiredAuth: true },
  settings:  { path: '/settings',  requiredAuth: true },
} satisfies RouteConfig;

// routes.home.path is typed as '/' (literal), not string
// routes.invalidKey would error at compile time
```

#### `as const` — Preserve Literal Types
```ts
// Replace enums with const objects for better tree-shaking
const ImageStatus = {
  PENDING: 'pending',
  VALIDATED: 'validated',
  REJECTED: 'rejected',
} as const;

type ImageStatus = (typeof ImageStatus)[keyof typeof ImageStatus];
// Result: 'pending' | 'validated' | 'rejected'
```

#### Type-Only Imports
```ts
// Always use explicit type-only imports (enforced by verbatimModuleSyntax)
import type { User, ImageFilters } from '@/types';
import { api } from '@/lib/api';
```

#### Utility Type Patterns
```ts
// Make specific fields required
type CreateImagePayload = Required<Pick<Image, 'title' | 'file'>> & Partial<Pick<Image, 'tags' | 'description'>>;

// Deep readonly for immutable data
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

// Extract component props
type ButtonProps = React.ComponentProps<typeof Button>;
```

### Common Pitfalls
- **Using `any`**: Use `unknown` and narrow with type guards. `any` disables all type checking.
- **Using `as` type assertions**: Prefer type narrowing (type guards, discriminated unions) over `as`. Exceptions: branded type constructors, test mocks.
- **Enums**: Replace with `as const` objects. Enums generate runtime code, are not tree-shakeable, and have quirky behavior.
- **`!` non-null assertion**: Indicates a type gap. Fix the type instead of asserting. Use `??` for defaults or handle `undefined` explicitly.
- **Implicit `any` in callbacks**: Always type callback parameters explicitly when inference fails.
- **Overly complex generics**: If a type requires more than 3 generic parameters, reconsider the design. Types should be readable.

### Testing TypeScript
- **Type testing**: Use `vitest` with `expectTypeOf` for compile-time type assertions:
```ts
import { expectTypeOf } from 'vitest';

it('queryKeys produce correct types', () => {
  expectTypeOf(queryKeys.images.detail('123')).toEqualTypeOf<readonly ['images', 'detail', string]>();
});
```
- Use `// @ts-expect-error` in tests to verify that invalid usage correctly fails to compile.
- Run `tsc --noEmit` in CI to catch type errors that tests might miss.

### Performance Considerations
- `verbatimModuleSyntax` + `isolatedModules` enable fast single-file transpilation in Vite.
- `skipLibCheck: true` reduces `tsc` time significantly — only checks your code, not `node_modules`.
- Use `import type` to eliminate runtime imports of type-only dependencies.
- `target: "ES2020"` with `lib: ["ES2020"]` matches modern browser baselines without unnecessary polyfills.

---

## Cross-Cutting Rules

### State Ownership Matrix
| Data Type | Tool | Example |
|-----------|------|---------|
| Server data (API responses) | TanStack Query | User profiles, image lists, validation results |
| Client UI state | Zustand | Modal open/close, sidebar state, theme preference |
| Form state (simple) | `useState` / `useActionState` | Single form inputs, toggles |
| Form state (complex) | React Hook Form or Zustand | Multi-step wizards |
| URL state | URL search params | Filters, pagination, sort order |
| Ephemeral state | `useState` | Hover state, animation state, local toggles |

### File Naming Conventions
```
src/
  components/
    ui/               # Shared design system components (Button, Input, Card)
    features/         # Feature-specific components
  hooks/              # Shared custom hooks
  stores/             # Zustand stores (useXxxStore.ts)
  queries/            # TanStack Query options and mutations (xxxQueries.ts)
  lib/                # Utilities (utils.ts, queryClient.ts, queryKeys.ts, api.ts)
  types/              # Shared TypeScript types
  test/               # Test utilities and setup
  pages/              # Route-level page components
```

### Import Order (enforce via ESLint)
```ts
// 1. React
import { useState, useEffect } from 'react';
// 2. External libraries
import { useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
// 3. Internal aliases (@/)
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { imageDetailOptions } from '@/queries/imageQueries';
// 4. Relative imports
import { ImageCard } from './ImageCard';
// 5. Types (always last, always type-only)
import type { Image, ImageFilters } from '@/types';
```
