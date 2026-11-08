# Domino Frontend

Standalone React + TypeScript + Vite frontend. This package includes the current dashboard, building graph, charts, incident tabs, and response workflow, with browser-only sample data. No backend, credentials, or environment variables are needed.

## Start

1. Install a Node.js version supported by package.json (Node 24.22.1 or a newer compatible 24.x release).
2. Install the specified package manager:

```sh
npm install -g pnpm@11.25.0
```

3. Open a terminal in this folder and run:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

4. Open http://127.0.0.1:5173.

If port 5173 is already occupied, use `pnpm dev --port 5174` and open http://127.0.0.1:5174.

## Try the UI

The app opens as a sample manager with two buildings and eight assets. Select **Inject chiller scenario** to explore the incident workflow. You can acknowledge, assign, propose, approve/reject, and resolve a simulated response.

All changes stay in the current browser tab and reset on reload. This preview has no authentication, database, persistence, or live synchronization. Risk values are scripted examples and financial estimates are illustrative.

## Connect your backend

Read [docs/BACKEND_HANDOFF.md](docs/BACKEND_HANDOFF.md).

- `src/lib/types.ts`: data and action contracts expected by the UI.
- `src/lib/connection.tsx`: replaceable data-provider boundary.
- `src/lib/preview/`: sample data and browser-only actions; replace when your backend is ready.
- `src/pages/` and `src/components/`: the frontend screens and reusable components.

## Checks and build

```sh
pnpm typecheck
pnpm test
pnpm build
```

The build produces `dist/`, ready for static hosting. For the optional browser check, keep the dev server running and use `pnpm test:ui` (requires Chrome on Windows, or `pnpm exec playwright install chromium`).

Dependencies, local tools, generated builds, credentials, and the retired backend are deliberately excluded from this shareable source package.
