# Frontend

A small Vite + React app with two screens: submit a prompt, then watch (and
act on) a single run as it moves through the backend's LangGraph pipeline.
There's no client-side state management library — the whole UI is driven by
polling one snapshot object and rendering off its `runStatus`.

## Tech stack, in depth

- **Vite + React 19 + TypeScript** — no meta-framework, no server-side
  rendering. `index.html` → [`main.tsx`](main.tsx) mounts `<App />` inside a
  `BrowserRouter`.
- **React Router** — exactly two routes, defined in [`App.tsx`](App.tsx):
  `/` ([`pages/Home.tsx`](pages/Home.tsx), the prompt form) and
  `/runs/:runId` ([`pages/RunPage.tsx`](pages/RunPage.tsx), everything else).
- **Plain CSS** — one stylesheet (`styles.css`), no Tailwind, no component
  library. Deliberate: this is a small enough UI that a framework would add
  more overhead than it saves.
- **[`api.ts`](api.ts)** — the only file that calls `fetch`. Three
  functions (`createRun`, `fetchRun`, `resumeRun`) map 1:1 to the backend's
  three routes and throw on a non-`ok` response; every component goes
  through these rather than calling `fetch` directly.
- **No state management library** — `RunPage` holds the current
  `RunSnapshot` in a single `useState`, polls `fetchRun` every 2 seconds
  *only* while `runStatus === 'working'` (stopping automatically once the
  graph pauses, finishes, or fails), and re-renders based on a `switch` over
  `runStatus`. A failed poll surfaces an error banner but doesn't get stuck
  — it clears itself the next time a poll succeeds, which matters here since
  a single run can sit in `working` for minutes at a time.
- **[`components/ReferenceGrid.tsx`](components/ReferenceGrid.tsx)** — the
  first human-review gate. Renders each candidate photo with the Cursor
  agent's note, lets the user approve/reject each one (with a reason field
  on reject), and submits a decision for *every* image — one the user never
  clicked defaults to `rejected`, not silently approved.
- **[`components/FinalReview.tsx`](components/FinalReview.tsx)** — the
  second gate: approve the generated image directly, or reject with a
  required-feeling reason that feeds back into the next generation attempt.
- Both review components accept a `capped` flag and render a banner when the
  backend's round-cap has been hit, and a `submitting` flag that disables
  their buttons and blocks double-submission while a `resumeRun` call is in
  flight (a resume can itself take minutes, since it triggers more Cursor
  agent calls server-side).
- **Vitest + Testing Library** — every component and page is tested by
  actually rendering it (`/** @vitest-environment jsdom */`) and driving it
  with `@testing-library/user-event`, not by shallow-rendering or mocking
  React internals. `RunPage.test.tsx` in particular drives a `MemoryRouter`
  through real navigation to confirm the app moves between routes, not just
  that a function was called.

## How it fits together

```
Home ──createRun──▶ navigate to /runs/:id
                          │
                          ▼
                      RunPage (polls fetchRun every 2s while runStatus === 'working')
                          │
              switch on runStatus:
              ├─ paused-references / capped-references ─▶ ReferenceGrid ──resumeRun──▶
              ├─ paused-final / capped-final          ─▶ FinalReview   ──resumeRun──▶
              ├─ done       → show the final image
              ├─ failed     → show state.error
              └─ abandoned  → terminal message
```

`shared/types.ts` (one level up) is the single source of truth for the
`RunSnapshot`/`RunState`/`PendingInterrupt` shapes — the frontend never
redefines them.

## Running it

Also always run from the repo root, alongside the backend:

```bash
npm run dev             # runs both — frontend on :5173, proxying /api and /run-files to :8787
```

or standalone (the API calls will fail without the backend running
separately):

```bash
npm run dev:client      # vite — just the frontend on :5173
```

Run just this directory's tests:

```bash
npx vitest run src
```
