# RackifAI

Interactive datacenter rack planner — drag-and-drop rack configuration with SVG, PDF, and Visio export.

**Try it now at [rackifai.com](https://rackifai.com)**

## Features

- **Drag & drop rack planning** — pick from 3,000+ real device types (sourced from the [NetBox DeviceType Library](https://github.com/netbox-community/devicetype-library)) and drag them into your rack with snap-to-U alignment
- **Multiple racks** — plan multi-rack layouts on a single canvas with pan and zoom
- **Export to SVG, PDF, or Visio** — vector-quality, print-ready exports generated entirely client-side
- **Power & weight tracking** — real-time capacity stats with warnings for power, weight, and airflow thresholds
- **Custom device types** — create your own devices with custom dimensions, power draw, and weight
- **Undo / redo** — full history with Ctrl+Z / Ctrl+Y
- **Cloud save & share** — save projects and share read-only links (hosted version)
- **Keyboard shortcuts** — Ctrl+S save, Ctrl+E export, Ctrl+D duplicate, and more (press `?` to see all)
- **Dark theme** — datacenter-aesthetic dark UI

## Self-Hosting

RackifAI can run standalone as a Docker container with no external dependencies — just SQLite for storage and optional local JWT auth.

### Docker (recommended)

```bash
docker run -d \
  -p 3000:3000 \
  -v rackifai-data:/data \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  ghcr.io/josephmcevoy/rackifai:latest
```

Open [http://localhost:3000](http://localhost:3000). Data is persisted in the `rackifai-data` volume.

### Docker Compose

```yaml
services:
  rackifai:
    image: ghcr.io/josephmcevoy/rackifai:latest
    ports:
      - "3000:3000"
    volumes:
      - rackifai-data:/data
    environment:
      JWT_SECRET: change-me-to-a-random-secret
      # AUTH_REQUIRED: "true"  # Enable multi-user mode

volumes:
  rackifai-data:
```

```bash
docker compose up -d
```

### Configuration

| Variable | Default | Description |
|-|-|-|
| `PORT` | `3000` | Server port |
| `DATABASE_PATH` | `/data/rackifai.db` | SQLite database file path |
| `JWT_SECRET` | (required) | Secret for signing auth tokens |
| `AUTH_REQUIRED` | `false` | Set `true` to enable multi-user mode with login |
| `ADMIN_USER_IDS` | | Comma-separated user IDs with admin access |

**Single-user mode** (default): no login required, all data belongs to a single default user.

**Multi-user mode** (`AUTH_REQUIRED=true`): users must register and log in. Passwords are hashed with PBKDF2.

## Development

### Prerequisites

- Node.js 22+
- npm

### Setup

```bash
git clone https://github.com/JosephMcEvoy/rackifai.git
cd rackifai
npm install
```

### Commands

| Command | Description |
|-|-|
| `npm run dev` | Dev server (Vite + Cloudflare Workers) |
| `npm run build` | Production build (Cloudflare) |
| `npm run build:standalone` | Production build (standalone SPA) |
| `npm start` | Run standalone server |
| `npm test` | Run tests |
| `npm run lint` | Lint |
| `npx tsc --noEmit` | Type check |

### Building the Docker image locally

```bash
docker build -t rackifai:local .
docker run -d -p 3000:3000 -e JWT_SECRET=dev-secret rackifai:local
```

## Tech Stack

| Layer | Technology |
|-|-|
| Frontend | React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| Canvas | Fabric.js v6 |
| Drag & Drop | dnd-kit |
| State | Zustand + Zundo (undo/redo) + Immer |
| Export | SVG (Fabric + SVGO), PDF (jsPDF + svg2pdf.js), Visio (JSZip) |
| API | Hono |
| Database | SQLite (D1 on Cloudflare, better-sqlite3 standalone) |
| ORM | Drizzle |
| Auth | Clerk (hosted) or local JWT (standalone) |
| Device Data | [NetBox DeviceType Library](https://github.com/netbox-community/devicetype-library) |

## Architecture

RackifAI uses an adapter pattern to run on both Cloudflare Workers and standalone Node.js:

```
src/          React SPA (canvas, UI, state)
worker/       Hono API routes + Cloudflare adapters (D1, KV, Clerk)
server/       Standalone adapters (better-sqlite3, local JWT, in-memory cache)
drizzle/      Database migrations (shared)
```

The same API routes serve both environments. Adapters for database, auth, and caching are selected at startup based on the runtime.

## License

[MIT](LICENSE) — Copyright (c) 2025-present Joseph McEvoy
