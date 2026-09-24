# Food Photo Realism Generator

Turns a text prompt (e.g. "nasi lemak with fried chicken") into a single
photorealistic food photo, deliberately engineered to avoid the common tells
of AI-generated ("slop") images — waxy textures, radial symmetry, garbled
text, oversaturated color grading.

Rather than generating straight from the text prompt, the pipeline first
finds real reference photos of the dish on the web, has a human vet them,
grounds the image-generation prompt in what's actually visible in those
approved photos, and puts a human in the loop again on the generated result
— with round-capped retry loops on both review gates so a stubborn prompt
can't loop forever.

## How it works

```
prompt
  │
  ▼
search reference photos (Openverse / Wikimedia)
  │
  ▼
Cursor Agent screens each candidate (real vs. likely AI-generated, relevant vs. not)
  │
  ▼
◆ human reviews reference photos ──reject──▶ search again (up to 5 rounds, then one
  │                                           grace decision before abandoning)
  approve
  ▼
Cursor Agent writes a generation prompt, grounded in the approved reference photos
  │
  ▼
Cursor Agent generates the image (GenerateImage tool)
  │
  ▼
◆ human reviews the generated image ──reject──▶ back to prompt-writing (same round cap)
  │
  approve
  ▼
done
```

Both human-review gates are implemented as a single LangGraph.js `StateGraph`
that pauses via `interrupt()` and resumes via `Command({ resume })` — the
graph genuinely stops and waits; there's no polling loop hand-rolled on top
of it.

## Tech stack

- **Backend**: Node + TypeScript, Express, `@langchain/langgraph` (the graph
  and its `MemorySaver` checkpointer), `@cursor/sdk` for all vision/writing/
  generation calls (model `composer-2.5`)
- **Frontend**: Vite + React + TypeScript, plain CSS (no UI framework)
- **Reference image search**: Openverse and Wikimedia Commons APIs (free,
  keyless)
- **Testing**: Vitest, Testing Library, Supertest

## Project layout

```
server/
├── graph/            # StateGraph definition, state schema, nodes, round-cap decision logic
├── agents/           # Cursor SDK wrappers: screening, prompt-writing, generation
├── prompts/          # System prompts + anti-slop guidance + few-shot slop examples
├── search/           # Openverse / Wikimedia clients + image download
├── routes/           # Express routes (create / read / resume a run)
└── env.ts            # Paths, ports, API key access

src/
├── pages/            # Home (prompt form), RunPage (polls + renders whichever review is pending)
└── components/       # ReferenceGrid, FinalReview

shared/types.ts        # Types shared between server and frontend (RunState, RunSnapshot, ...)
runs/{runId}/           # Downloaded reference photos + generated images for each run (gitignored)
```

## Running it locally

```bash
npm install
cp .env.example .env   # in app/ — set CURSOR_API_KEY
npm run dev
```

This starts the Express API (port 8787) and the Vite dev server (port 5173,
proxying `/api` and `/run-files` to Express) together. Open
[http://localhost:5173](http://localhost:5173), describe a dish, and work
through the two review gates.

## Design docs

The full design rationale and the implementation plan live under
[`docs/superpowers/`](docs/superpowers/) — including the anti-slop prompt
scaffold, the round-cap semantics, and the API contract.
