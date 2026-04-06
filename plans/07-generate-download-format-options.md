# 07 — Format Download Options for Generated Images

**Date:** 2026-04-04
**Status:** Approved

## Problem

Generated images have a single "Download" button that serves the file in whatever format it was processed in. Users cannot choose between JPEG, PNG, or WebP — unlike the upload flow which already offers format selection via `DownloadSection.tsx`.

## Solution

Add a segmented format selector (JPEG | PNG | WebP) above the Download button in the generation result card. The backend gains a `?format=` query parameter that converts on-the-fly with Sharp.

## Backend

**File:** `apps/api/src/routes/generate.ts` — `GET /api/v1/generate/:id/download`

- Accept optional query parameter `?format=jpeg|png|webp`
- Normalize `jpg` → `jpeg`
- If format differs from stored format, convert with Sharp:
  - PNG → `.png()`
  - JPEG → `.jpeg({ quality: 85, mozjpeg: true })`
  - WebP → `.webp({ quality: 85 })`
- Update `Content-Type` and filename extension to match requested format
- Pattern already proven in `routes/images.ts` lines 291–308

## Frontend

**New component:** `apps/web/src/components/FormatSelector.tsx`

- Segmented button group with 3 options: JPEG, PNG, WebP
- Props: `formats: string[]`, `selected: string`, `onChange: (fmt: string) => void`
- Styled as inline pill buttons matching the existing dark theme

**Modified:** `apps/web/src/components/GeneratePanel.tsx`

- Import `FormatSelector`
- Add local state `selectedFormat`, defaulting to `job.image.format` (lowercased, `jpeg` normalized to `jpg` for display)
- Download URL becomes: `/api/v1/generate/{id}/download?format={selectedFormat}`

## Edge Cases

- **Transparency + JPEG:** JPEG flattens alpha to white. No warning — deliberate user choice.
- **No format param:** Backend returns the file as-is (backwards compatible).
- **Same format requested:** No conversion, serves original file.

## Testing

- **Backend:** `?format=webp` returns correct `Content-Type` and valid image buffer
- **Frontend:** `FormatSelector` renders 3 options, defaults correctly, calls onChange
