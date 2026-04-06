# Filter Bar Redesign — Design Document

> **Date:** 2026-04-05
> **Author:** Gabriel + Claude
> **Status:** Approved

## Overview

Replace the current 3-row filter bar (4 unlabeled dropdowns + date pickers + category chips) with a Linear-style filter pill pattern. One clean row with search + date presets + "+ Filtro" button. Active filters appear as clickable, removable pills.

## Problems with Current Design

1. No labels on dropdowns — 4 selects all showing "Todos" with no indication of what they filter
2. Everything visible at once — 6-8 filters compete for attention
3. Category chips are unlabeled — "User", "Gamification" float with no context
4. Raw date inputs — "dd/mm/aaaa" is developer-facing
5. No visual hierarchy — all controls have equal weight

## Layout

### No active filters (default):

```
[🔍 Buscar por prompt ou arquivo...]  [Hoje] [Semana] [Mês] [Todos]  [+ Filtro]
```

### With active filters:

```
[🔍 Buscar por prompt...]  [Modelo: Recraft V3 ✕] [Status: Sucesso ✕]
                           [Hoje] [Semana] [Mês] [Todos]  [+ Filtro]  Limpar
```

- Search input: `flex-1`, fills available space
- Pills: wrap to second row if needed
- Date presets: always visible, chip-group, radio-style
- "+ Filtro": always last, after date presets
- "Limpar": text button, only visible when filters active

## "+ Filtro" Popover

Single popover with two states:

### State 1 — Filter list:

```
┌──────────────────────┐
│ Modo                 │
│ Categoria            │
│ Modelo               │
│ Qualidade            │
│ Status               │
└──────────────────────┘
```

- Simple flat list of clickable rows
- Already-active filters show a checkmark/dot on the right
- Still clickable to edit value

### State 2 — Value picker:

```
┌──────────────────────┐
│ ← Modelo             │
├──────────────────────┤
│ ○ Recraft V3         │
│ ○ FLUX.2 Pro         │
└──────────────────────┘
```

- Back arrow + filter name as header
- Single-select (Modo, Modelo, Qualidade, Status): radio-style, click applies + closes
- Multi-select (Categoria): checkbox-style, stays open, click outside to close

### Filter options:

| Filter | Type | Values |
|---|---|---|
| Modo | Single | Geração, Upload |
| Categoria | Multi | Admin/Branding, Conteúdo, Gamificação, Usuário |
| Modelo | Single | Recraft V3, FLUX.2 Pro |
| Qualidade | Single | Baixa, Média, Alta |
| Status | Single | Sucesso, Erro |

No "Todos" option — removing the pill resets to all.

## Filter Pills

### Anatomy:

```
┌─────────────────────────┐
│ Modelo: Recraft V3   ✕  │
└─────────────────────────┘
```

- Styling: `bg-primary/15 text-primary border-primary/30 rounded-full px-3 py-1 text-sm font-medium`
- Two click zones: label (opens value picker anchored to pill) and ✕ (removes filter)
- Multi-select: comma-joined values, truncated. If >30 chars: `Categoria: 3 selecionadas ✕`
- Hover: `bg-primary/20`
- Keyboard: Backspace/Delete removes focused pill, focus moves to adjacent pill or "+ Filtro"
- Order: chronological (order added)

## Component Architecture

| Component | Action |
|---|---|
| `HistoryFilterBar.tsx` | Rewrite — new layout |
| `FilterPopover.tsx` | New — two-state popover |
| `FilterPill.tsx` | New — clickable/removable pill |
| `useHistoryFilters.ts` | Keep as-is — no changes |
| `HistoryFilterBar.test.tsx` | Rewrite — new tests |

Data flow unchanged: user interacts → setFilter()/toggleCategory() → URL updates → React Query refetches.

## Accessibility

- Filter bar: `role="toolbar"` with `aria-label="Filtros"`
- Popover: `role="dialog"`, Escape closes
- Pills: `role="button"`, `aria-label="Remover filtro: Modelo Recraft V3"` on ✕
- Keyboard: Tab into bar, arrow keys between controls, Enter/Space to activate, Backspace to remove pill
