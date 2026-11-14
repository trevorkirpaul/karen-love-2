# Karen Kirpaul (Guyton), DPM — Astro Website

Podiatric medicine practice website built with **Astro**, **Tailwind CSS v4**, and **Starwind UI**, configured for self-hosted VPS deployment behind **Caddy**.

## Architecture

- **Prerendered Frontend (`src/pages/index.astro`)**: Static HTML with optimized images (`astro:assets`) and minimal client-side JS (only for the bio expand toggle and contact form submission).
- **Starwind UI (`src/components/starwind/`)**: Source-owned Astro components (`Card`, `Item`, `Field`, `Input`, `Textarea`, `Button`, `Alert`, `Avatar`, `Badge`, `Spinner`).
- **Self-Hosted Contact API (`src/pages/api/contact.ts`)**: Server-rendered Astro API route (`@astrojs/node`) replacing Netlify Forms. Includes:
  - Zod schema validation (`src/lib/contact/schema.ts`)
  - Honeypot spam filtering (`website` field)
  - Sliding-window IP rate limiting (`src/lib/contact/rate-limit.ts`)
  - SMTP (`nodemailer`) or webhook delivery (`src/lib/contact/mailer.ts`)
- **Health Check (`src/pages/api/health.ts`)**: `GET /api/health` for Caddy/uptime monitoring.

## Development

```bash
cp .env.example .env
npm install
npm run dev
```

## Testing & Verification

```bash
npm test          # Run Vitest unit & API integration tests
npm run check     # Run Astro & TypeScript type checking
npm run build     # Build production server + static assets
```

## Deploying to a VPS under Caddy

1. Build the project on your server (or CI):
   ```bash
   npm ci
   npm run build
   ```
2. Configure environment variables in `.env` (at minimum `SMTP_HOST`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`, or `CONTACT_WEBHOOK_URL`).
3. Run the standalone Astro Node server (e.g., via `systemd`):
   ```bash
   NODE_ENV=production HOST=127.0.0.1 PORT=4321 node --env-file=.env ./dist/server/entry.mjs
   ```
4. Point Caddy to `127.0.0.1:4321` using `Caddyfile.example` as a template.
