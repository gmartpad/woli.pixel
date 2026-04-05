# Image Type Presets — Traceability

Where each of the 19 resolution presets in "Seleção de Tipo" comes from across the Woli ecosystem.

## Derivation Chain

```
Constantes.cs (legacy C# backend, ~2018)
  ↓
hackathon-mvp-prd-assistente-imagens.md (PRD, April 2026)
  ↓
woli.pixel/apps/api/src/db/seed.ts (current source of truth)
```

---

## Category A — Admin / Branding (500 KB max)

**Primary source:** `gestaorh-back-front/Fontes/Woli.GestaoRH.BO/Config/Constantes.cs` (lines 33–50)

All 9 admin presets were reverse-engineered from the legacy Woli backend constants file, which defines upload constraints for the LMS platform's admin panel.

| # | typeKey | displayName | Resolution | Aspect Ratio | Source File | Source Line | Services |
|---|---------|-------------|-----------|--------------|-------------|-------------|----------|
| 1 | `logo_topo` | Logo Topo (Header) | variable, ≥200px | variable | `Constantes.cs` | 34 | LMS Web |
| 2 | `logo_relatorios` | Logo Relatórios | 650 × 200 | 3.25:1 | `Constantes.cs` | 35 | LMS Web |
| 3 | `fundo_login` | Fundo Login Desktop | 1600 × 900 | 16:9 | `Constantes.cs` | 36 | LMS Web |
| 4 | `fundo_login_mobile` | Fundo Login Mobile | 375 × 820 | ~9:20 | `Constantes.cs` | 37 | App Mobile |
| 5 | `icone_pilula` | Ícone Notificação Pílula | 72 × 72 | 1:1 | `Constantes.cs` | 38 | LMS Web, App Mobile |
| 6 | `favicon` | Favicon | 128 × 128 | 1:1 | `Constantes.cs` | 39 | LMS Web |
| 7 | `testeira_email` | Testeira E-mail | 600 × 100 | 6:1 | `Constantes.cs` | 40 | E-mail |
| 8 | `logo_app` | Logo Interno App | variable, ≥200px | variable | `Constantes.cs` | 41 | App Mobile |
| 9 | `logo_dispersao` | Logo Mapa Dispersão | 27 × 27 | 1:1 | `Constantes.cs` | 42 | Gestão RH |

### Notes

- **logo_topo / logo_app** have no fixed dimensions — only a minimum width of 200px. The platform accepts variable aspect ratios for header logos.
- **fundo_login_mobile** (375 × 820) maps to an iPhone SE-class viewport. The ~9:20 ratio is unusual but matches real device constraints.
- **logo_dispersao** (27 × 27) is the smallest preset — a tiny marker icon overlaid on a geographic dispersion map in Gestão RH.
- **testeira_email** is the branded strip that appears at the top of platform notification emails. "Testeira" literally means "forehead piece" — the thing at the top.

---

## Category B — Conteúdo / Workspace (10 MB max)

**Primary sources:**
- `gestaorh-back-front/Fontes/Woli.GestaoRH.BO/Config/Constantes.cs` (lines 10–12)
- `hackathon-mvp-prd-assistente-imagens.md` (PRD table, lines ~602–633)
- `woli.workspace.react.front/src/components/Form/NewRoom/index.tsx` (workspace cover handling)

| # | typeKey | displayName | Resolution | Aspect Ratio | Source File(s) | Services |
|---|---------|-------------|-----------|--------------|----------------|----------|
| 10 | `conteudo_imagem` | Imagem de Conteúdo | 1920 × 1080 | 16:9 | `Constantes.cs` lines 10–11 | LMS Web, App Mobile |
| 11 | `capa_workspace` | Capa Workspace | 300 × 300 | 1:1 | Hackathon PRD + `NewRoom/index.tsx` (`imagemCapa` field) | LMS Web, App Mobile |
| 12 | `fundo_workspace` | Fundo Workspace | 1920 × 1080 | 16:9 | Hackathon PRD + workspace frontend | LMS Web, App Mobile |
| 13 | `icone_curso` | Ícone de Curso | 256 × 256 | 1:1 | `Constantes.cs` line 12 + Hackathon PRD | LMS Web, App Mobile |

### Notes

- **conteudo_imagem / fundo_workspace** share the same 1920×1080 Full HD resolution but serve different purposes — one is inline educational content, the other is a workspace background.
- **icone_curso** is the only type restricted to **JPG only** (no PNG/GIF). This constraint comes from the legacy LMS backend.
- **capa_workspace** (300 × 300) was derived from real workspace card component usage in `woli.workspace.react.front`, where the cover image is rendered as a square thumbnail.
- These types allow up to **10 MB** — 20× larger than admin presets — because educational content images need higher fidelity.

---

## Category C — Usuário (1 MB max)

**Primary sources:**
- `hackathon-mvp-prd-assistente-imagens.md` (line 632)
- `woli.workspace.react.front/src/screens/ForumArea/` (Avatar component usage from @mui/material)

| # | typeKey | displayName | Resolution | Aspect Ratio | Source File(s) | Services |
|---|---------|-------------|-----------|--------------|----------------|----------|
| 14 | `foto_aluno` | Foto de Perfil | 256 × 256 | 1:1 | Hackathon PRD + Forum Avatar components | LMS Web, App Mobile |

### Notes

- **foto_aluno** is the only type in its category. The 256×256 standard was established by how the LMS renders user avatars across the forum, profile, and ranking screens.
- The 1 MB limit sits between admin (500 KB) and content (10 MB) — user photos need reasonable quality but don't need the fidelity of educational content.

---

## Category D — Gamificação (500 KB max)

**Primary source:** `woli.pixel/plans/05-gamification-asset-validation.md` (lines 20–80)

These 5 presets are **new to Pixel** — they don't originate from the legacy Woli backend. They were spec'd during Pixel's own feature planning for gamification asset validation.

| # | typeKey | displayName | Resolution | Aspect Ratio | Source File | Services |
|---|---------|-------------|-----------|--------------|-------------|----------|
| 15 | `badge_conquista` | Badge de Conquista | 128 × 128 | 1:1 | `05-gamification-asset-validation.md` | LMS Web, App Mobile |
| 16 | `medalha_ranking` | Medalha de Ranking | 96 × 96 | 1:1 | `05-gamification-asset-validation.md` | LMS Web, App Mobile |
| 17 | `icone_recompensa` | Ícone de Recompensa | 200 × 200 | 1:1 | `05-gamification-asset-validation.md` | LMS Web, App Mobile |
| 18 | `banner_campanha` | Banner de Campanha | 1200 × 300 | 4:1 | `05-gamification-asset-validation.md` | LMS Web, App Mobile |
| 19 | `avatar_personagem` | Avatar de Personagem | 256 × 256 | 1:1 | `05-gamification-asset-validation.md` | LMS Web, App Mobile |

### Notes

- All gamification types target both LMS Web and App Mobile — gamification features are cross-platform.
- **badge_conquista**, **medalha_ranking**, and **avatar_personagem** require transparency (PNG only) because they're rendered over colored backgrounds.
- **banner_campanha** is the only wide (4:1) gamification asset — it's a promotional banner shown at the top of the gamification section during special campaigns.
- **medalha_ranking** (96 × 96) is intentionally smaller than **badge_conquista** (128 × 128) because medals appear in denser ranking lists.

---

## Source Files Index

| File Path | Role | Relevant Lines |
|-----------|------|----------------|
| `gestaorh-back-front/Fontes/Woli.GestaoRH.BO/Config/Constantes.cs` | Legacy backend — original image specs | 10–12, 33–50 |
| `hackathon-mvp-prd-assistente-imagens.md` | PRD — documented all original 13 types with rationale | 602–633 |
| `woli.pixel/plans/05-gamification-asset-validation.md` | Feature spec — 5 gamification types | 20–80 |
| `woli.pixel/apps/api/src/db/seed.ts` | **Current source of truth** — all 19 types | 4–313 |
| `woli.pixel/apps/api/src/db/schema.ts` | DB schema — `imageTypes` table definition | 4–22 |
| `woli.workspace.react.front/src/components/Form/NewRoom/index.tsx` | Workspace cover image handling | `imagemCapa` field |
| `woli.workspace.react.front/src/screens/ForumArea/` | Forum avatar component usage | Multiple files |
