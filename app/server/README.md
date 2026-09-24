# Server

The backend: an Express API in front of a LangGraph.js `StateGraph` that
orchestrates the whole prompt → reference search → human review → generation
→ human review pipeline. Every "AI" step (screening photos, writing the
generation prompt, generating the image) goes through a Cursor SDK Agent;
everything else here is plain TypeScript.

## Tech stack, in depth

- **Express 5** — three routes, no middleware beyond `express.json()` and
  static file serving. See [`routes/runs.ts`](routes/runs.ts) and
  [`index.ts`](index.ts).
- **`@langchain/langgraph`** — the actual orchestration engine. A single
  compiled `StateGraph` (built once, module-level, in
  [`graph/build.ts`](graph/build.ts)) with a `MemorySaver` checkpointer, so
  run state lives in the Node process's memory only — it does not survive a
  server restart. State is defined with `Annotation.Root` in
  [`graph/state.ts`](graph/state.ts); every node returns a partial state
  update, exactly like a reducer.
- **LangGraph `interrupt()` / `Command({ resume })`** — the two human-review
  gates ([`graph/nodes/reviewReferences.ts`](graph/nodes/reviewReferences.ts),
  [`graph/nodes/reviewFinal.ts`](graph/nodes/reviewFinal.ts)) call
  `interrupt()`, which genuinely suspends that node's execution. Resuming
  happens by calling `compiledGraph.invoke(new Command({ resume: payload }),
  config)` — see `resumeRun` in `graph/build.ts`. There is no hand-rolled
  polling loop underneath this; LangGraph's checkpointer is what makes the
  pause durable across HTTP requests.
- **`@cursor/sdk`** — the only thing that touches an actual model. Every
  Cursor call goes through the single wrapper in
  [`agents/cursorAgent.ts`](agents/cursorAgent.ts) (`runCursorAgent`), which
  uses the model id from the `CURSOR_MODEL` env var (defaults to
  `composer-2.5` if unset — see `CURSOR_MODEL` in `env.ts`), always runs with `local: { cwd:
  REPO_ROOT }` (the repo root, not a per-run directory — this is what lets
  one agent invocation read both `runs/{id}/...` and
  `prompts/ai-slop-examples/...` in the same call), and never restricts the
  agent's built-in toolset. Three role-specific wrappers sit on top of it in
  `agents/`:
  - `screenReferences.ts` — vision, judges candidate photos, writes a
    `notes.json` the calling node reads back
  - `writeGenerationPrompt.ts` — vision, reads the approved reference photos
    and writes the actual image-generation prompt to a text file
  - `generateImage.ts` — calls the `GenerateImage` tool with that prompt,
    writes a PNG
- **Openverse + Wikimedia Commons** ([`search/`](search/)) — free, keyless
  APIs for finding real reference photos. `search/index.ts`'s
  `findReferenceCandidates` tries Openverse first and only queries Wikimedia
  for whatever's still short; `search/download.ts` fetches the bytes to
  disk under `runs/{id}/references/`.
- **Vitest + Supertest** — every node, agent wrapper, and route is unit- or
  integration-tested with all I/O (network, Cursor SDK, filesystem timing)
  mocked at the module boundary. The one exception is
  [`graph/nodes/reviewReferences.test.ts`](graph/nodes/reviewReferences.test.ts)
  and
  [`graph/nodes/reviewFinal.test.ts`](graph/nodes/reviewFinal.test.ts),
  which build a real throwaway `StateGraph` + `MemorySaver` to exercise
  actual `interrupt()`/`Command`/`getState()` mechanics, and
  [`graph/build.test.ts`](graph/build.test.ts), which drives the *entire*
  assembled graph through a full run (happy path, both reject-loops, a
  thrown-error failure) with only the network/Cursor/filesystem boundary
  mocked.

## How data flows

1. `POST /api/runs` → `startRun` (`graph/build.ts`) creates a `runId`, seeds
   the checkpointer with the initial state, and fires the graph
   (`invokeAndCapture`) in the background — it returns immediately, it does
   not wait for the first interrupt.
2. `GET /api/runs/:id` → `getRunSnapshot` reads the current checkpoint and,
   if the graph is paused, extracts the pending `interrupt()` payload
   (converting internal filesystem paths to public `/run-files/...` URLs via
   `toPublicPath` in `env.ts`).
3. `POST /api/runs/:id/resume` → validates the body shape against whichever
   interrupt is actually pending, then `resumeRun` continues the graph with
   `Command({ resume: payload })` and returns the next snapshot (this call
   blocks until the graph reaches the next interrupt or finishes, since
   resuming genuinely runs the next leg of the pipeline).
4. Any node throwing anywhere is caught by `invokeAndCapture` and persisted
   as `runStatus: 'failed'` — there is no automatic retry.

The round-cap logic (max 5 retry rounds per gate, then one grace decision
before abandoning) lives entirely in the pure, dependency-free
[`graph/decisions.ts`](graph/decisions.ts) — it's the one file in this
directory with no I/O and no LangGraph import, deliberately, so the
trickiest logic in the pipeline is the easiest to unit test.

## Running it

The server has no standalone `npm run` script of its own — it's always run
together with the frontend from the repo root:

```bash
npm run dev            # from the repo root — runs both server and client
```

or, if you only want the API (e.g. to hit it with curl while the frontend is
off):

```bash
npm run dev:server     # tsx watch server/index.ts — Express on :8787
```

Requires `CURSOR_API_KEY` in `app/.env` (copy `app/.env.example`). `PORT` defaults to `8787`; `CURSOR_MODEL` defaults to
`composer-2.5` if unset — set it to swap the model used for every agent
call.

Run just this directory's tests:

```bash
npx vitest run server
```
