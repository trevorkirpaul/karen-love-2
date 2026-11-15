# Project Map & Rules
- **Pages:** `src/pages/`
- **Components & Layouts:** `src/components/`, `src/layouts/`
- **Styles & Config:** `src/styles/`, `astro.config.mjs`
- **Validation:** Run `npm run build && npm run test:visual` before committing.

# Repository Instructions

- **Framework:** Astro static site (`src/pages/`, `src/components/`, `src/layouts/`, `src/styles/`) with a standalone Node.js contact API server (`server/contact.ts`, `src/lib/contact/`).
- **Project Layout:**
  - `src/pages/` — Astro pages and API routes (`index.astro`, `api/contact.ts`, `api/health.ts`)
  - `src/components/sections/` — Page section components
  - `src/components/starwind/` — Starwind UI components
  - `src/layouts/` — Shared page layouts (`BaseLayout.astro`)
  - `src/data/profile.ts` — Practice, bio, services, locations, and publications data
  - `src/lib/contact/` — Contact form validation (`schema.ts`), rate limiting (`rate-limit.ts`), delivery (`mailer.ts`), and request handler (`handler.ts`)
  - `server/contact.ts` — Standalone HTTP server for the contact API in production
  - `tests/` — Vitest unit and API tests
- **Build & Validation:** Always run `npm run build` before finishing any edit to ensure zero build or TypeScript errors. Also run `npm run test:visual` after `npm run build` to verify there is no horizontal overflow, broken image, or console error on mobile (`375px`, `390px`), tablet (`768px`), or desktop (`1280px`). Run `npm run check` (Astro & TypeScript checks), `npm test` (Vitest), and `npm run build:server` when modifying server or contact API code.
- **Responsive UI Rules:** Never introduce horizontal scroll on mobile or tablet. Use `min-w-0`, `flex-wrap`, `max-w-full`, and responsive sizing/visibility rather than fixed widths or `whitespace-nowrap` on multi-word headers/buttons.
- **Git Workflow:** Never push directly to `main`. Create a descriptive feature/fix branch, commit changes, and open a Pull Request with `gh pr create` summarizing the updates.
