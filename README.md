# Mister F

Mister F is a web application for English practice with an AI tutor. The main
application lives in `misterf-web/`; system documentation lives in `docs/`.

## Quick Links

- [Web App README](./misterf-web/README.md): setup, scripts, environment,
  database, build, and PM2 operations
- [Documentation Index](./docs/README.md): architecture, tutor runtime,
  operations, feature notes, and issue trackers
- [V1 Cleanup Tracker](./docs/issues/v1-project-cleanup-tracker.md): current
  release-readiness tracker

## Local Start

```bash
cd misterf-web
npm ci
cp .env.example .env.development
npm run dev
```

Open `http://localhost:5005` when `PORT=5005` is set in `.env.development`.
