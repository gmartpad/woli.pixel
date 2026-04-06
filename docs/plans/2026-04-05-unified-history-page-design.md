# Unified History Page — Design Document

> **Date:** 2026-04-05
> **Author:** Gabriel + Claude
> **Status:** Approved

## Overview

Replace the current session-only `ProcessingHistory` component with a full-featured unified history page that shows all generated and processed images from the database. Users can filter, browse, inspect, compare, and manage their image history from a single location.

## Requirements

- **Unified view** — both generation history (`generationJobs`) and upload/processing history (`imageUploads`) in one page
- **Full filtering** — mode, category, model, quality tier, status, date range (presets + custom), prompt/filename search
- **Date-grouped grid** — cards grouped by date with sticky headers, "Load More" pagination
- **Detail panel** — right side drawer (~40% width) with metadata, prompt, actions, compact comparison
- **Lightbox** — full-screen overlay for image inspection and before/after comparison slider
- **Actions** — download (with format selector), delete, re-generate (generations), re-process (uploads)
- **Responsive** — side panel degrades to bottom sheet below 1024px

## Data Architecture

### Unified History API

```
GET /api/v1/history?page=1&per_page=24
  &mode=all|generation|upload
  &status=all|completed|error
  &category=admin,content,gamification,user,custom
  &model=recraft_v3,flux2_pro
  &quality=low,medium,high
  &search=prompt text
  &date_from=2026-04-01T00:00:00Z
  &date_to=2026-04-05T23:59:59Z
  &date_preset=today|yesterday|this_week|this_month|all
```

### Unified Response Shape

```ts
type HistoryItem = {
  id: string;
  mode: "generation" | "upload";
  status: "completed" | "error";
  createdAt: string;

  // Common
  thumbnailUrl: string;
  downloadUrl: string;
  category: string | null;
  imageTypeName: string | null;
  finalWidth: number;
  finalHeight: number;
  finalFormat: string;
  finalSizeKb: number;

  // Generation-specific
  prompt: string | null;
  enhancedPrompt: string | null;
  model: string | null;
  qualityTier: string | null;
  costUsd: number | null;

  // Upload-specific
  originalFilename: string | null;
  originalWidth: number | null;
  originalHeight: number | null;
  originalSizeKb: number | null;
  aiQualityScore: number | null;
};

type HistoryResponse = {
  items: HistoryItem[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
};
```

### Query Strategy

- SQL `UNION ALL` of `generationJobs` and `imageUploads`, projected into `HistoryItem` shape
- Filters applied as `WHERE` clauses before the union
- `ORDER BY created_at DESC`, `LIMIT/OFFSET` for pagination
- `COUNT(*)` over same union for `total`

## UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Filter Bar (sticky)                                          │
│ [Search] [Mode] [Categoria] [Modelo] [Qualidade] [Status]   │
│ [Hoje|Semana|Mes|Todos] [Custom date]                       │
│ Active: [chip x] [chip x]                     Limpar Todos  │
├─────────────────────────────────────┬────────────────────────┤
│ Grid (~60%)                         │ Detail Panel (~40%)    │
│                                     │                        │
│ -- Hoje - 5 de abril, 2026 -----   │ [Image Preview]        │
│ [card] [card] [card]               │ Metadata Table         │
│                                     │ Prompt                 │
│ -- Ontem - 4 de abril, 2026 ----   │ Actions                │
│ [card] [card]                      │                        │
│                                     │                        │
│ Mostrando 24 de 156                │                        │
│ [Carregar Mais]                    │                        │
└─────────────────────────────────────┴────────────────────────┘
```

## Component Tree

```
HistoryPage
├── HistoryFilterBar
│   ├── SearchInput (debounced 300ms)
│   ├── FilterDropdown x5 (mode, category, model, quality, status)
│   ├── DatePresetChips (Hoje | Esta Semana | Este Mes | Todos)
│   ├── DateRangePicker (custom calendar)
│   └── ActiveFilterChips (dismissible + "Limpar Todos")
├── HistoryGrid
│   ├── DateGroupHeader (sticky, relative + absolute date)
│   ├── HistoryCard[] (thumbnail + badges + meta)
│   ├── LoadMoreButton ("Mostrando X de Y")
│   └── HistoryEmptyState (first-use | no-results | error)
├── HistoryDetailPanel (right drawer)
│   ├── ImagePreview (clickable -> lightbox)
│   ├── MetadataTable (adaptive per mode)
│   ├── CompactComparison (before/after toggle, uploads only)
│   └── ActionBar (download, compare, re-generate/re-process, delete)
└── HistoryLightbox (full-screen overlay)
    ├── FullSizeImage
    ├── ComparisonSlider (draggable vertical divider)
    └── NavigationArrows (keyboard + click)
```

## Card Design

- **Thumbnail** — aspect-ratio-preserved, `object-cover`, dark background
- **Status badge** — bottom-left overlay (green dot success, red dot error)
- **Mode badge** — bottom-right chip ("Geracao" blue, "Upload" purple)
- **Title** — imageTypeName or truncated filename or "Personalizado"
- **Meta line** — `{w}x{h} . {format} . {size}KB`
- **Time** — hour:minute (date in sticky group header)
- **States** — default, hover (scale + bg change), selected (primary border), error (muted)

## Detail Panel

- Slides in from right, 200ms ease-out
- Grid resizes from 4 to 3 columns to accommodate
- Prev/Next arrows cycle through filtered results
- Adaptive sections per mode:
  - Generation: modelo, qualidade, custo, prompt, enhanced prompt, re-gerar
  - Upload: original filename, antes/depois comparison, ai quality score, re-processar
- Escape closes, arrow keys navigate grid items

## Lightbox

- Dark overlay (`bg-black/90`)
- Two modes: single view (full-size) and compare (slider)
- Compare mode: draggable vertical divider between original and processed (uploads)
- Navigation: arrow keys, position indicator "1/24"
- `role="dialog"`, `aria-modal="true"`, focus trap, Escape closes

## Filter Bar

| Control | Type | Options |
|---|---|---|
| Search | Text input, debounced | Searches prompt + filename |
| Modo | Dropdown, single-select | Todos, Geracao, Upload |
| Categoria | Dropdown, multi-select | Admin, Conteudo, Gamificacao, Usuario, Personalizado |
| Modelo | Dropdown, single-select | Todos, Recraft V3, FLUX.2 Pro |
| Qualidade | Dropdown, single-select | Todas, Baixa, Media, Alta |
| Status | Dropdown, single-select | Todos, Sucesso, Erro |
| Date presets | Chip group | Hoje, Esta Semana, Este Mes, Todos |
| Custom date | Calendar picker | date_from + date_to |

Smart behavior: Modelo and Qualidade disabled when mode = "Upload".

## Empty States

1. **First-use** — "Nenhuma imagem no historico" + CTAs to generate or upload
2. **No results** — "Nenhum resultado encontrado" + "Limpar Filtros" CTA
3. **Error** — error message + "Tentar Novamente"

## Loading States

- Initial: 12 skeleton cards with shimmer animation
- Load More: 6 skeleton cards appended
- Filter change: skeleton swap (replace grid content)
- Images: blur-up transition (`blur(4px)` -> `blur(0)`), `loading="lazy"`

## State Management

| Data | Tool |
|---|---|
| History items, pagination | React Query (`useInfiniteQuery`) |
| Filter values | URL search params |
| Selected item, panel/lightbox open | Zustand (`useHistoryStore`) |
| Lightbox compare toggle | Local `useState` |

## Backend Changes

1. **New route:** `GET /api/v1/history` — unified endpoint with all filters
2. **New route:** `GET /api/v1/history/:id/thumbnail` — Sharp resize to 400px, JPEG q80, cached
3. **New route:** `DELETE /api/v1/history/:id` — deletes DB row + S3 file
4. **DB:** Add index on `generationJobs.prompt` for text search

## Implementation Phases

1. **Backend foundation** — history endpoint, thumbnail route, delete route, indexes
2. **Frontend foundation** — hooks, store, empty state, card, grid
3. **Filter bar** — all controls, URL sync, React Query wiring
4. **Detail panel** — adaptive metadata, actions, panel behavior
5. **Lightbox & comparison** — full-screen view, comparison slider
6. **Integration & polish** — replace ProcessingHistory, wire actions, responsive

## Testing Strategy

- Backend: route integration tests with `app.request()`, PGlite for DB, all filter combinations
- Frontend: RTL + Vitest, behavior-first testing, fresh QueryClient per test
- TDD: red-green-refactor for every component and hook
