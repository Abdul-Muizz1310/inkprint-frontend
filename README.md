<p align="center">
  <img src="assets/demo.gif" alt="demo" width="720"/>
</p>

<h1 align="center">inkprint-frontend</h1>
<p align="center">
  <em>Content provenance certificate viewer — the visual layer for inkprint</em>
</p>

<p align="center">
  <a href="https://inkprint-frontend.vercel.app">Live Demo</a> •
  <a href="WHY.md">Why</a> •
  <a href="docs/ARCHITECTURE.md">Architecture</a> •
  <a href="docs/DEMO.md">Demo Script</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/Abdul-Muizz1310/inkprint-frontend/ci.yml" alt="ci"/>
  <img src="https://img.shields.io/github/license/Abdul-Muizz1310/inkprint-frontend" alt="license"/>
</p>

---

## What it does

<!-- TODO: fill in S6 -->

## The unique angle

<!-- TODO: fill in S6 -->

## Quick start

```bash
git clone https://github.com/Abdul-Muizz1310/inkprint-frontend.git
cd inkprint-frontend
cp .env.example .env.local
pnpm install && pnpm dev
```

## Benchmarks / Evals

<!-- TODO: fill in S6 -->

## Architecture

<!-- TODO: Mermaid diagram in S6 -->

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | shadcn + Tailwind CSS v4 |
| State | Zustand + TanStack Query |
| Editor | Monaco |
| Diff | react-diff-viewer-continued |
| QR | qrcode.react |
| Testing | Vitest + Playwright |
| Lint | Biome |
| Deploy | Vercel |

## Deployment

Vercel, auto-deploy from `main`. Backend at `https://inkprint-backend.onrender.com`.

## License

BUSL-1.1
