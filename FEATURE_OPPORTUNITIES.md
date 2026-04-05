# Feature Opportunities for Woli Pixel

Based on the current codebase (13 image types, 3-step AI pipeline, single-image flow) and Woli's ecosystem (700K+ users, white-label LMS/LXP, Autor-IA, Content Factory, gamification engine, WoliHub).

---

## Tier 1 — High Impact / High Feasibility (build on existing architecture)

### 1. Batch Upload & Validation

Currently Woli Pixel processes one image at a time. The Content Factory and Autor-IA generate dozens of assets per course. Add a multi-file dropzone that queues uploads, runs AI analysis in parallel, and shows a summary dashboard with pass/fail per image. The backend already handles individual processing — this is mostly a frontend queue + a batch status endpoint.

### 2. Brand Consistency Checker

Woli's white-label clients each have distinct branding. Upload a client's brand kit (logo, primary/secondary colors, fonts) and Woli Pixel validates whether uploaded images match the brand palette. Claude Vision already extracts `dominant_colors` — extend this to compare against a stored brand profile and flag deviations (e.g., "This banner uses #FF5733 but the client's primary is #1A73E8").

### 3. Course Catalog Audit Mode

Instead of validating new uploads, point Woli Pixel at an existing course catalog (or a folder of current thumbnails/banners). It scans every image, generates a quality report (scores, issues, inconsistencies), and flags the worst offenders. This directly addresses the pain point of 5,000+ courses with inconsistent visual quality.

### 4. Autor-IA Quality Gate

Integrate as a validation step in Autor-IA's pipeline. When the AI generates an image for a course, Woli Pixel automatically validates dimensions, quality score, content appropriateness, and brand alignment before it's embedded in the course. Reject or flag images below a configurable threshold (e.g., quality score < 7).

### 5. Gamification Asset Validation

Add image types for badges, medals, achievement icons, and virtual store product images. These have strict requirements (transparent backgrounds, consistent sizing, icon-style composition). The `image_types` table and seed data already support this pattern — just add new entries and corresponding preview contexts.

---

## Tier 2 — Medium Impact / Medium Effort

### 6. Smart Accessibility Analysis

- **Alt-text generation**: Use Claude Vision to auto-generate descriptive alt-text in Portuguese for every image (critical for WCAG compliance)
- **Contrast ratio check**: For images containing text overlays, validate that text/background contrast meets WCAG AA (4.5:1) or AAA (7:1)
- **Color blindness simulation**: Preview how images appear under deuteranopia, protanopia, tritanopia
- This is a strong differentiator — few competing tools do this for corporate training images

### 7. Multi-Tenant Image Specs

Different white-label clients may need different image specifications (e.g., Client A wants 1200×400 banners, Client B wants 1600×500). Add a tenant/client dimension to `image_types` so each white-label instance has its own validation rules. Store client profiles with their specific specs and brand kit.

### 8. Content Moderation / Appropriateness Filter

Corporate training images must be professional. Use Claude Vision to flag potentially inappropriate content (violence, explicit material, culturally insensitive imagery) before it reaches learners. Especially important for user-uploaded profile photos and user-generated content.

### 9. Certificate Template Validation

Woli Live auto-generates certificates. Add specific image types for certificate backgrounds, logos, and signature images. Validate that they'll render correctly at print resolution (300 DPI) and screen resolution, and that text areas remain readable when overlaid.

### 10. CDN-Ready Multi-Format Export

Instead of downloading a single file, generate a responsive image set: original quality, thumbnail (300px), mobile (750px), desktop (1920px), and retina (2x). Output in WebP with JPEG fallback. This directly impacts the 74% of users accessing via mobile — pages load faster with properly sized images.

---

## Tier 3 — Strategic / Longer-Term

### 11. Visual Consistency Scoring Across Catalogs

Go beyond individual image quality — score visual coherence across an entire course catalog. Detect when one course uses photographic thumbnails while another uses illustrations, or when color temperatures vary wildly. Output a "catalog consistency score" with specific recommendations.

### 12. Image Similarity & Duplicate Detection

Use perceptual hashing or embedding-based similarity to detect duplicate or near-duplicate images across the platform. With 5,000+ courses, the same stock photos often appear repeatedly. Flag duplicates and suggest alternatives.

### 13. Smart Template System

Pre-built, editable templates for common Woli image types (course cards, email headers, login backgrounds). Users select a template, upload their content image, and Woli Pixel composites it with proper dimensions, brand colors, and text overlay zones. Reduces dependency on graphic designers.

### 14. API/Webhook Integration with Woli LMS

Expose Woli Pixel as a microservice. When an admin uploads an image to the LMS, a webhook triggers Woli Pixel validation. If the image fails quality checks, the upload is blocked with a clear explanation. Turns Woli Pixel from a standalone tool into platform infrastructure.

### 15. Analytics Dashboard

Track image quality trends over time: average quality scores, most common issues, processing volume, format distribution, size reduction achieved. Show per-client stats for white-label instances. Helps T&D managers quantify the improvement Woli Pixel brings.

### 16. Intelligent Cropping UI

The AI already returns `crop_suggestion` with subject center coordinates, but there's no interactive crop interface. Add a draggable crop overlay on the original image, pre-positioned based on the AI suggestion, that users can adjust before processing. Show rule-of-thirds grid and safe zones.

### 17. Watermark & Metadata Management

- **Add watermarks**: Configurable text/logo overlay for proprietary training materials
- **Strip metadata**: Remove EXIF/GPS data from user-uploaded photos for privacy (LGPD compliance)
- **Inject metadata**: Add copyright, author, and license info to processed images

### 18. WoliHub Digital Product Covers

WoliHub has 300+ e-books and audiobooks. Add image types for e-book covers, audiobook tiles, and promotional graphics (scratch cards, spin wheels). These have distinct specs from the LMS types — more marketing-oriented, need to be eye-catching at small sizes.

---

## Feature × Hackathon Criteria Matrix

| Feature | C1 Impact (25%) | C2 AI Usage (25%) | C3 Innovation (15%) | C4 Feasibility (15%) | C5 Maturity (20%) |
|---|---|---|---|---|---|
| Batch Processing | High | Medium | Low | High | High |
| Brand Consistency | Very High | High | High | Medium | Medium |
| Catalog Audit | Very High | High | High | Medium | Medium |
| Autor-IA Gate | Very High | High | Medium | Medium | Medium |
| Gamification Assets | High | Medium | Low | Very High | High |
| Accessibility (alt-text) | Very High | Very High | Very High | Medium | Medium |
| Multi-Tenant Specs | High | Low | Medium | Medium | Medium |
| Content Moderation | High | High | Medium | High | Medium |
| Certificate Validation | Medium | Medium | Low | Very High | High |
| CDN Multi-Format | High | Low | Medium | High | High |
