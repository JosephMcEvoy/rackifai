# Contributing to RackifAI

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

### Prerequisites

- Node.js 22+
- npm

### Getting started

```bash
git clone https://github.com/JosephMcEvoy/rackifai.git
cd rackifai
npm install
npm run dev
```

This starts the Vite dev server with Cloudflare Workers emulation.

### Standalone mode (no Cloudflare)

```bash
npm run build:standalone
npm start
```

Or with Docker:

```bash
docker build -t rackifai:local .
docker run -p 3000:3000 -e JWT_SECRET=dev-secret rackifai:local
```

## Commands

| Command | Description |
|-|-|
| `npm run dev` | Dev server |
| `npm test` | Run tests |
| `npm run lint` | Lint |
| `npx tsc --noEmit` | Type check |
| `npm run build` | Build (Cloudflare) |
| `npm run build:standalone` | Build (standalone) |

## Before Submitting a PR

1. Run `npm run lint` — no errors
2. Run `npx tsc --noEmit` — no type errors
3. Run `npm test` — all tests pass
4. Keep commits focused — one logical change per commit

## Code Style

- TypeScript strict mode
- Path aliases: `@/` maps to `src/`
- Tailwind CSS v4 for styling
- shadcn/ui components in `src/components/ui/`
- State management through Zustand stores in `src/store/`
- Dark theme by default

## Project Structure

```
src/          React SPA (canvas, UI, state)
worker/       Hono API routes + Cloudflare adapters
server/       Standalone adapters (SQLite, local auth)
drizzle/      Database migrations
```

## What to Work On

Check [open issues](https://github.com/JosephMcEvoy/rackifai/issues) for tasks labeled `good first issue` or `help wanted`. If you want to work on something larger, open an issue first to discuss the approach.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
