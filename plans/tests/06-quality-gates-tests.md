# Test Plan 06 — Quality Gates (Feature 4)

> Covers: Gate config CRUD, policy evaluation engine, file/URL validation, webhook integration, history.

## Feature Surface

### Backend
- **Routes:** `apps/api/src/routes/quality-gates.ts`
  - `POST /` — create gate config
  - `GET /` — list configs
  - `GET /:id` — get config
  - `PUT /:id` — update config
  - `DELETE /:id` — cascade delete (config + results)
  - `POST /:id/validate` — upload + analyze + evaluate (synchronous)
  - `POST /:id/validate-url` — fetch URL + validate
  - `GET /:id/history` — paginated gate results
  - `POST /webhook` — async webhook validation
- **Services:**
  - `quality-gate.ts` — `evaluateGate()` rule engine
  - `transparency-validator.ts` — `analyzeTransparency()` (used by gate checks)
- **Middleware:** `webhook-auth.ts` — HMAC-SHA256 signature verification
- **DB:** `qualityGateConfigs` table, `gateResults` table

### Frontend
- **Components:** `GateConfigManager.tsx`, `GateTestPanel.tsx`, `GateResultsDashboard.tsx`
- **Store:** `gate-store.ts`
- **API Client:** `createGateConfig()`, `getGateConfigs()`, `getGateConfig()`, `updateGateConfig()`, `deleteGateConfig()`, `validateImageWithGate()`, `getGateHistory()`

---

## Backend Tests

### `apps/api/src/services/quality-gate.test.ts` — Evaluation Engine

| # | Test | Scenario | Expected Verdict |
|---|------|----------|------------------|
| 1 | All checks pass | score=8, no blur, no low_res, size ok | "pass" |
| 2 | Score below minimum | score=4, minQualityScore=6 | "fail", failures includes "quality_score" |
| 3 | Blur detected when required no blur | blur_detected=true, requireNoBlur=true | "fail", failures includes blur |
| 4 | Low resolution when required | low_resolution=true, requireNoLowResolution=true | "fail" |
| 5 | Width below minimum | width=100, requireMinWidth=200 | "fail" |
| 6 | Height below minimum | height=100, requireMinHeight=200 | "fail" |
| 7 | Content type not in whitelist | type="screenshot", allowed=["photo","logo"] | "fail" |
| 8 | Content type in blacklist | type="screenshot", blocked=["screenshot"] | "fail" |
| 9 | File size exceeds max | 600KB, maxFileSizeKb=500 | "fail" |
| 10 | Multiple failures collected | score=3, blur=true, oversized | "fail", failures has 3+ items |
| 11 | Brand score < 60 triggers warning only | brandResult.score=50 | "warn" (not fail), warnings includes brand |
| 12 | Brand score >= 60 no warning | brandResult.score=80 | No brand warning |
| 13 | No brand check when no brandResult | brandResult=undefined | No brand warning |
| 14 | Whitelist/blacklist not checked when empty | allowedContentTypes=null | Passes content type check |
| 15 | Details include per-check breakdown | Any scenario | details has `*_check: {required, actual, passed}` |

### `apps/api/src/services/transparency-validator.test.ts`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Detects transparency in transparent PNG | PNG with alpha | has_alpha_channel=true, transparency_percentage > 0 |
| 2 | No transparency in opaque JPEG | JPEG input | has_alpha_channel=false, transparency_percentage=0 |
| 3 | Detects solid background | Image with uniform bg | background_is_solid=true |
| 4 | Detects edge transparency | PNG with transparent edges | edge_transparency=true |
| 5 | Returns issues for opaque image needing transparency | Opaque PNG for transparent-required type | issues non-empty |

### `apps/api/src/middleware/webhook-auth.test.ts`

| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Valid signature passes | Correct HMAC-SHA256 | returns true |
| 2 | Invalid signature fails | Wrong signature | returns false |
| 3 | Empty signature fails | "" | returns false |
| 4 | Malformed signature prefix fails | "md5=abc123" | returns false |
| 5 | Timing-safe comparison used | Correct + incorrect | Consistent timing (no early exit) |

### `apps/api/src/routes/quality-gates.test.ts`

#### Config CRUD

| # | Test | Method | Expected |
|---|------|--------|----------|
| 1 | Create config with defaults | POST / `{ name }` | 201, minQualityScore=6, requireNoBlur=true |
| 2 | Create config with all options | POST / (full body) | 201, all fields stored |
| 3 | Create with generate_secret | POST / `{ generate_secret: true }` | webhookSecret is 64-char hex |
| 4 | List configs ordered by name | GET / | 200, sorted array |
| 5 | Get config by ID | GET /:id | 200, full config |
| 6 | Update config | PUT /:id `{ min_quality_score: 8 }` | 200, field updated |
| 7 | Update with regenerate secret | PUT /:id `{ generate_secret: true }` | New secret different from old |
| 8 | Delete config cascades results | DELETE /:id | 200, results also deleted |
| 9 | Delete returns 404 for missing | DELETE /fake-id | 404 |

#### Validation

| # | Test | Method | Expected |
|---|------|--------|----------|
| 10 | Validate file returns verdict | POST /:id/validate (file) | 200, verdict + score + details |
| 11 | Validate stores gateResult in DB | POST /:id/validate | gateResults row created |
| 12 | Validate with passing image | POST /:id/validate (good image) | verdict="pass" |
| 13 | Validate with failing image | POST /:id/validate (bad image) | verdict="fail", failures non-empty |
| 14 | Validate includes brand check if configured | Config has brandProfileId | Brand score evaluated |
| 15 | Validate-url fetches and validates | POST /:id/validate-url `{ url }` | 200, same result shape |
| 16 | Validate-url rejects invalid URL | POST /:id/validate-url `{ url: "" }` | 400 |
| 17 | Validate returns 404 for missing config | POST /fake/validate | 404 |

#### History

| # | Test | Method | Expected |
|---|------|--------|----------|
| 18 | History returns paginated results | GET /:id/history | 200, results array, page, perPage |
| 19 | History filters by verdict | GET /:id/history?verdict=fail | Only failed results |
| 20 | History pagination works | GET /:id/history?page=2&per_page=5 | Correct offset |

#### Webhook

| # | Test | Method | Expected |
|---|------|--------|----------|
| 21 | Webhook accepts valid request | POST /webhook (valid sig) | 202 |
| 22 | Webhook rejects invalid signature | POST /webhook (bad sig) | 401 |
| 23 | Webhook works without secret (no sig required) | POST /webhook (no secret configured) | 202 |
| 24 | Webhook callback POSTs result to callback_url | POST /webhook `{ callback_url }` | Result POSTed (mock) |

---

## Frontend Tests

### `apps/web/src/stores/gate-store.test.ts`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Initial state has no selectedConfigId | Default null |
| 2 | Selecting config updates selectedConfigId | ID stored |
| 3 | Deselecting config clears state | Reset works |

### `apps/web/src/components/gates/GateConfigManager.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Lists gate configs from API | Configs rendered |
| 2 | Create form has name + all options | Form fields present |
| 3 | Default values shown (minScore=6, noBlur=true) | Defaults applied |
| 4 | Selecting a config updates gate store | Store selectedConfigId set |
| 5 | Delete button removes config | Config removed from list |
| 6 | Active/inactive toggle works | isActive toggled |

### `apps/web/src/components/gates/GateTestPanel.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Shows upload zone for test image | Drop zone rendered |
| 2 | Displays verdict after validation | "pass"/"fail"/"warn" shown |
| 3 | Shows failures list on fail | Failure reasons listed |
| 4 | Shows warnings list on warn | Warning reasons listed |
| 5 | Shows quality score | Score displayed |
| 6 | Hidden when no config selected | Returns null |

### `apps/web/src/components/gates/GateResultsDashboard.test.tsx`

| # | Test | What it verifies |
|---|------|------------------|
| 1 | Shows pass/fail/warn distribution | Counts displayed |
| 2 | History table shows recent results | Results listed |
| 3 | Filter by verdict works | Filtered list |
| 4 | Hidden when no config selected | Returns null |
