# Food Photo Realism Webapp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a webapp that turns a text prompt (e.g. "nasi lemak with fried chicken") into a single photorealistic, non-AI-slop food photo, using a LangGraph.js graph with two human-in-the-loop review gates and Cursor SDK for all vision/generation work.

**Architecture:** An Express API server hosts a LangGraph.js `StateGraph` (in-memory `MemorySaver` checkpointer) that: searches Openverse/Wikimedia for real reference photos, has a Cursor Agent screen them, pauses for human approval, has a Cursor Agent write a grounded generation prompt and another generate the image, then pauses again for human approval. A Vite + React frontend polls the run and renders whichever review UI is currently pending. Round-capped retry loops (max 5) protect against runaway cost.

**Tech Stack:** TypeScript, Node 22, Express 5, `@langchain/langgraph` 1.4.14, `@cursor/sdk` 1.0.31, Vite + React 19, Vitest + Testing Library + Supertest.

**Spec:** `docs/superpowers/specs/2026-09-09-food-photo-realism-webapp-design.md`

## Global Constraints

- Node >= 22.13 (repo already targets this; confirmed installed: v22.17.0).
- TypeScript `strict: true` in both `tsconfig.json` (frontend) and `tsconfig.server.json` (backend).
- `MAX_ROUNDS = 5` for both the reference-review loop and the final-image-review loop (user-specified hard cap; first breach holds for one grace decision, a second non-approval after that abandons the run).
- Cursor model is always `{ id: 'composer-2.5' }`, matching the proven pattern from the reference project. No built-in tool restrictions (`tools` option) — use the default toolset, as the reference project does.
- All Cursor Agents run with `local: { cwd: REPO_ROOT }` (the repo root), never a per-run directory — this lets one agent invocation read both `runs/{id}/...` and `server/prompts/ai-slop-examples/...`. All paths given to an agent in its task text must be repo-root-relative; all paths our own Node code uses for `fs` calls must be absolute.
- No automatic retries on Cursor/network failure — a thrown error inside a node marks the run `failed` and stops. The human resubmits a new prompt.
- No UI framework/component library — plain React + minimal CSS. No Tailwind, no shadcn (this is a standalone project, not sharing conventions with any other repo).
- Checkpointer is `MemorySaver` (in-memory only) — a server restart loses in-flight runs. This is accepted for a local/solo project per the spec.
- Every dependency version below was confirmed to exist on the npm registry before being written into this plan.

---

## Task 1: Project scaffolding + Express health endpoint

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.server.json`
- Create: `vite.config.ts`
- Create: `vitest.setup.ts`
- Create: `index.html`
- Create: `.env.example`
- Create: `server/env.ts`
- Create: `server/index.ts`
- Test: `server/index.test.ts`

**Interfaces:**
- Produces: `REPO_ROOT: string`, `PORT: number`, `getCursorApiKey(): string` from `server/env.ts`, consumed by every later server file that needs the repo root or the API key.
- Produces: `app` (an Express application, not listening) exported from `server/index.ts`, consumed by `server/index.test.ts` and later route tests.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "langgraph-ai-image-generator",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": { "node": ">=22.13" },
  "scripts": {
    "dev": "concurrently -n server,client -c blue,green \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "tsx watch server/index.ts",
    "dev:client": "vite",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.server.json --noEmit",
    "build": "npm run typecheck && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@cursor/sdk": "^1.0.31",
    "@langchain/langgraph": "^1.4.14",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-router-dom": "^7.18.3"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.7",
    "@types/express": "^5.0.6",
    "@types/node": "^22.20.1",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.7",
    "@types/supertest": "^7.2.1",
    "@vitejs/plugin-react": "^6.1.1",
    "concurrently": "^10.0.5",
    "jsdom": "^30.0.1",
    "supertest": "^7.2.2",
    "tsx": "^4.23.13",
    "typescript": "^5.7.3",
    "vite": "^8.2.2",
    "vitest": "^5.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs cleanly, creates `package-lock.json` and `node_modules/`.

- [ ] **Step 3: Write `tsconfig.json` (frontend)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "shared"]
}
```

- [ ] **Step 4: Write `tsconfig.server.json` (backend)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["server", "shared"]
}
```

- [ ] **Step 5: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Food Photo Realism Generator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/runs': 'http://localhost:8787',
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'server/**/*.test.ts',
      'shared/**/*.test.ts',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
  },
})
```

- [ ] **Step 7: Write `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 8: Write `.env.example`**

```
CURSOR_API_KEY=
PORT=8787
```

- [ ] **Step 9: Write `server/env.ts`**

```ts
import path from 'node:path'

export const REPO_ROOT = process.cwd()
export const RUNS_ROOT = path.join(REPO_ROOT, 'runs')
export const PORT = Number(process.env.PORT ?? 8787)

export function getCursorApiKey(): string {
  const key = process.env.CURSOR_API_KEY?.trim()
  if (!key) throw new Error('CURSOR_API_KEY is missing. Add it to .env.')
  return key
}
```

- [ ] **Step 10: Write the failing test for the health endpoint**

Create `server/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from './index.js'

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })
})
```

- [ ] **Step 11: Run the test to verify it fails**

Run: `npx vitest run server/index.test.ts`
Expected: FAIL — `server/index.ts` does not exist yet.

- [ ] **Step 12: Write `server/index.ts`**

```ts
import 'dotenv/config'
import express from 'express'
import { PORT } from './env.js'

export const app = express()
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
  })
}
```

- [ ] **Step 13: Run the test to verify it passes**

Run: `npx vitest run server/index.test.ts`
Expected: PASS

- [ ] **Step 14: Verify the dev servers start**

Run: `npm run dev:server` (in one terminal), then `curl http://localhost:8787/api/health` in another.
Expected: `{"status":"ok"}`. Stop the server (Ctrl+C) afterward.

- [ ] **Step 15: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.server.json vite.config.ts vitest.setup.ts index.html .env.example server/env.ts server/index.ts server/index.test.ts
git commit -m "Scaffold project with Express health endpoint"
```

---

## Task 2: Shared types + graph state schema

**Files:**
- Create: `shared/types.ts`
- Modify: `server/env.ts` (add `runDir` and `toPublicPath`)
- Create: `server/graph/state.ts`
- Test: `server/graph/state.test.ts`

**Interfaces:**
- Consumes: `RUNS_ROOT`, `REPO_ROOT` from `server/env.ts` (Task 1).
- Produces: `ReferenceImage`, `ReferenceStatus`, `FinalStatus`, `RunStatus`, `RunState`, `ReferenceDecision`, `ResumeReferencesPayload`, `ResumeFinalPayload`, `PendingInterrupt`, `RunSnapshot` types from `shared/types.ts` — consumed by every later server and frontend file.
- Produces: `runDir(runId: string): string`, `toPublicPath(absolutePath: string): string` from `server/env.ts` — consumed by graph nodes and `server/graph/state.ts`.
- Produces: `RunAnnotation`, `GraphState` (type), `createInitialState(runId: string, prompt: string): GraphState`, `toPublicRunState(state: GraphState): RunState` from `server/graph/state.ts` — consumed by all graph nodes and `server/graph/build.ts`.

- [ ] **Step 1: Write `shared/types.ts`**

```ts
export type ReferenceStatus = 'pending' | 'approved' | 'rejected'

export type ReferenceImage = {
  id: string
  sourceUrl: string
  localPath: string
  cursorNote?: string
  status: ReferenceStatus
  rejectReason?: string
}

export type FinalStatus = 'pending' | 'approved' | 'rejected'

export type RunStatus =
  | 'working'
  | 'paused-references'
  | 'paused-final'
  | 'capped-references'
  | 'capped-final'
  | 'done'
  | 'abandoned'
  | 'failed'

export type RunState = {
  prompt: string
  referenceImages: ReferenceImage[]
  excludedSourceUrls: string[]
  referenceRound: number
  generationPrompt?: string
  generatedImagePath?: string
  finalStatus: FinalStatus
  finalRejectReason?: string
  finalRound: number
  runStatus: RunStatus
  error?: string
}

export type ReferenceDecision = {
  id: string
  status: 'approved' | 'rejected'
  rejectReason?: string
}

export type ResumeReferencesPayload = {
  decisions: ReferenceDecision[]
}

export type ResumeFinalPayload = {
  status: 'approved' | 'rejected'
  rejectReason?: string
}

export type PendingInterrupt =
  | { type: 'references'; images: ReferenceImage[]; capped: boolean }
  | { type: 'final'; imageUrl: string; capped: boolean }
  | null

export type RunSnapshot = {
  runId: string
  state: RunState
  pendingInterrupt: PendingInterrupt
}
```

- [ ] **Step 2: Add `runDir` and `toPublicPath` to `server/env.ts`**

Modify `server/env.ts` (append after `getCursorApiKey`):

```ts
export function runDir(runId: string): string {
  return path.join(RUNS_ROOT, runId)
}

export function toPublicPath(absolutePath: string): string {
  const relative = path.relative(RUNS_ROOT, absolutePath).split(path.sep).join('/')
  return `/runs/${relative}`
}
```

- [ ] **Step 3: Write the failing test for the state schema**

Create `server/graph/state.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { createInitialState, toPublicRunState } from './state.js'

describe('createInitialState', () => {
  it('builds a fresh working state for a new run', () => {
    const state = createInitialState('run-1', 'nasi lemak with fried chicken')
    expect(state).toMatchObject({
      runId: 'run-1',
      prompt: 'nasi lemak with fried chicken',
      referenceImages: [],
      excludedSourceUrls: [],
      referenceRound: 0,
      finalStatus: 'pending',
      finalRound: 0,
      runStatus: 'working',
    })
  })
})

describe('toPublicRunState', () => {
  it('strips internal fields and rewrites local paths to public URLs', () => {
    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = [
      {
        id: 'a',
        sourceUrl: 'https://x/a.jpg',
        localPath: path.join(process.cwd(), 'runs', 'run-1', 'references', 'a.jpg'),
        status: 'pending',
      },
    ]
    state.generatedImagePath = path.join(process.cwd(), 'runs', 'run-1', 'generated', 'attempt-0.png')

    const publicState = toPublicRunState(state) as Record<string, unknown>

    expect(publicState).not.toHaveProperty('runId')
    expect(publicState).not.toHaveProperty('lastReferenceOutcome')
    expect(publicState).not.toHaveProperty('lastFinalOutcome')
    expect((publicState.referenceImages as { localPath: string }[])[0].localPath).toBe(
      '/runs/run-1/references/a.jpg',
    )
    expect(publicState.generatedImagePath).toBe('/runs/run-1/generated/attempt-0.png')
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run server/graph/state.test.ts`
Expected: FAIL — `server/graph/state.ts` does not exist yet.

- [ ] **Step 5: Write `server/graph/state.ts`**

Note: this imports `ReferenceReviewOutcome` and `FinalReviewOutcome` types from `./decisions.js`, which is created in Task 3. Declare them there first, or define these two type aliases inline here for now — Task 3 will own the canonical definitions and this file only needs the type names to match exactly.

```ts
import { Annotation } from '@langchain/langgraph'
import type { FinalStatus, ReferenceImage, RunState, RunStatus } from '../../shared/types.js'
import type { FinalReviewOutcome, ReferenceReviewOutcome } from './decisions.js'
import { toPublicPath } from '../env.js'

export const RunAnnotation = Annotation.Root({
  runId: Annotation<string>(),
  prompt: Annotation<string>(),
  referenceImages: Annotation<ReferenceImage[]>(),
  excludedSourceUrls: Annotation<string[]>(),
  referenceRound: Annotation<number>(),
  generationPrompt: Annotation<string | undefined>(),
  generatedImagePath: Annotation<string | undefined>(),
  finalStatus: Annotation<FinalStatus>(),
  finalRejectReason: Annotation<string | undefined>(),
  finalRound: Annotation<number>(),
  runStatus: Annotation<RunStatus>(),
  error: Annotation<string | undefined>(),
  lastReferenceOutcome: Annotation<ReferenceReviewOutcome | undefined>(),
  lastFinalOutcome: Annotation<FinalReviewOutcome | undefined>(),
})

export type GraphState = typeof RunAnnotation.State

export function createInitialState(runId: string, prompt: string): GraphState {
  return {
    runId,
    prompt,
    referenceImages: [],
    excludedSourceUrls: [],
    referenceRound: 0,
    generationPrompt: undefined,
    generatedImagePath: undefined,
    finalStatus: 'pending',
    finalRejectReason: undefined,
    finalRound: 0,
    runStatus: 'working',
    error: undefined,
    lastReferenceOutcome: undefined,
    lastFinalOutcome: undefined,
  }
}

export function toPublicRunState(state: GraphState): RunState {
  return {
    prompt: state.prompt,
    referenceImages: state.referenceImages.map((image) => ({
      ...image,
      localPath: toPublicPath(image.localPath),
    })),
    excludedSourceUrls: state.excludedSourceUrls,
    referenceRound: state.referenceRound,
    generationPrompt: state.generationPrompt,
    generatedImagePath: state.generatedImagePath ? toPublicPath(state.generatedImagePath) : undefined,
    finalStatus: state.finalStatus,
    finalRejectReason: state.finalRejectReason,
    finalRound: state.finalRound,
    runStatus: state.runStatus,
    error: state.error,
  }
}
```

This file will not type-check until Task 3 creates `server/graph/decisions.ts`. That's expected — Task 3 is next and is a hard prerequisite. Do not run `npm run typecheck` until after Task 3.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run server/graph/state.test.ts`
Expected: PASS (Vitest transpiles per-file and does not fail on the not-yet-existing `decisions.js` type-only import at runtime, since type-only imports are erased — but create Task 3's file before moving on regardless).

- [ ] **Step 7: Commit**

```bash
git add shared/types.ts server/env.ts server/graph/state.ts server/graph/state.test.ts
git commit -m "Add shared types and LangGraph state schema"
```

---

## Task 3: Reference & final review decision logic

**Files:**
- Create: `server/graph/decisions.ts`
- Test: `server/graph/decisions.test.ts`

**Interfaces:**
- Consumes: `ReferenceDecision`, `ReferenceImage`, `ResumeFinalPayload`, `RunStatus`, `FinalStatus` from `shared/types.ts` (Task 2).
- Produces: `MAX_ROUNDS`, `applyReferenceDecisions(referenceImages, excludedSourceUrls, decisions)`, `ReferenceReviewOutcome`, `decideReferenceOutcome({ referenceImages, referenceRound, runStatus })`, `applyFinalDecision(payload)`, `FinalReviewOutcome`, `decideFinalOutcome({ finalStatus, finalRound, runStatus })` — consumed by `server/graph/nodes/reviewReferences.ts` and `server/graph/nodes/reviewFinal.ts` (Tasks 12, 14), and by `server/graph/state.ts` (Task 2, type-only).

This is the highest-value task to get exactly right: it is the only place round-capping and abandon logic lives, and it has no I/O, so it should be tested exhaustively before it's wired into the graph.

- [ ] **Step 1: Write the failing tests**

Create `server/graph/decisions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  applyFinalDecision,
  applyReferenceDecisions,
  decideFinalOutcome,
  decideReferenceOutcome,
  MAX_ROUNDS,
} from './decisions.js'
import type { ReferenceImage } from '../../shared/types.js'

function image(id: string, overrides: Partial<ReferenceImage> = {}): ReferenceImage {
  return {
    id,
    sourceUrl: `https://example.com/${id}.jpg`,
    localPath: `/tmp/${id}.jpg`,
    status: 'pending',
    ...overrides,
  }
}

describe('applyReferenceDecisions', () => {
  it('applies status and rejectReason to matching images only', () => {
    const result = applyReferenceDecisions(
      [image('a'), image('b')],
      [],
      [{ id: 'a', status: 'approved' }, { id: 'b', status: 'rejected', rejectReason: 'AI-looking' }],
    )
    expect(result.referenceImages).toEqual([
      image('a', { status: 'approved' }),
      image('b', { status: 'rejected', rejectReason: 'AI-looking' }),
    ])
  })

  it('adds rejected sourceUrls to excludedSourceUrls, de-duplicated', () => {
    const result = applyReferenceDecisions(
      [image('a')],
      ['https://example.com/old.jpg'],
      [{ id: 'a', status: 'rejected', rejectReason: 'no good' }],
    )
    expect(result.excludedSourceUrls.sort()).toEqual(
      ['https://example.com/a.jpg', 'https://example.com/old.jpg'].sort(),
    )
  })

  it('leaves images with no matching decision untouched', () => {
    const result = applyReferenceDecisions([image('a', { status: 'approved' })], [], [])
    expect(result.referenceImages).toEqual([image('a', { status: 'approved' })])
  })
})

describe('decideReferenceOutcome', () => {
  it('proceeds when every image is approved', () => {
    const outcome = decideReferenceOutcome({
      referenceImages: [image('a', { status: 'approved' })],
      referenceRound: 0,
      runStatus: 'working',
    })
    expect(outcome).toBe('proceed')
  })

  it('retries when not all approved and under the round cap', () => {
    const outcome = decideReferenceOutcome({
      referenceImages: [image('a', { status: 'rejected' })],
      referenceRound: MAX_ROUNDS - 1,
      runStatus: 'working',
    })
    expect(outcome).toBe('retry')
  })

  it('holds at the cap the first time the round limit is hit', () => {
    const outcome = decideReferenceOutcome({
      referenceImages: [image('a', { status: 'rejected' })],
      referenceRound: MAX_ROUNDS,
      runStatus: 'working',
    })
    expect(outcome).toBe('hold-capped')
  })

  it('abandons when already capped and still not all approved', () => {
    const outcome = decideReferenceOutcome({
      referenceImages: [image('a', { status: 'rejected' })],
      referenceRound: MAX_ROUNDS,
      runStatus: 'capped-references',
    })
    expect(outcome).toBe('abandon')
  })

  it('proceeds even when already capped, if the human approves everything', () => {
    const outcome = decideReferenceOutcome({
      referenceImages: [image('a', { status: 'approved' })],
      referenceRound: MAX_ROUNDS,
      runStatus: 'capped-references',
    })
    expect(outcome).toBe('proceed')
  })

  it('treats an empty image list as not-approved (never auto-proceeds)', () => {
    const outcome = decideReferenceOutcome({ referenceImages: [], referenceRound: 0, runStatus: 'working' })
    expect(outcome).toBe('retry')
  })
})

describe('applyFinalDecision', () => {
  it('carries the status and reject reason through', () => {
    expect(applyFinalDecision({ status: 'rejected', rejectReason: 'too glossy' })).toEqual({
      finalStatus: 'rejected',
      finalRejectReason: 'too glossy',
    })
  })
})

describe('decideFinalOutcome', () => {
  it('is done when approved, regardless of round', () => {
    expect(decideFinalOutcome({ finalStatus: 'approved', finalRound: MAX_ROUNDS, runStatus: 'capped-final' })).toBe(
      'done',
    )
  })

  it('retries when rejected and under the cap', () => {
    expect(decideFinalOutcome({ finalStatus: 'rejected', finalRound: MAX_ROUNDS - 1, runStatus: 'working' })).toBe(
      'retry',
    )
  })

  it('holds at the cap the first time the round limit is hit', () => {
    expect(decideFinalOutcome({ finalStatus: 'rejected', finalRound: MAX_ROUNDS, runStatus: 'working' })).toBe(
      'hold-capped',
    )
  })

  it('abandons when already capped and rejected again', () => {
    expect(decideFinalOutcome({ finalStatus: 'rejected', finalRound: MAX_ROUNDS, runStatus: 'capped-final' })).toBe(
      'abandon',
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/graph/decisions.test.ts`
Expected: FAIL — `server/graph/decisions.ts` does not exist yet.

- [ ] **Step 3: Write `server/graph/decisions.ts`**

```ts
import type { ReferenceDecision, ReferenceImage, ResumeFinalPayload, RunStatus, FinalStatus } from '../../shared/types.js'

export const MAX_ROUNDS = 5

export function applyReferenceDecisions(
  referenceImages: ReferenceImage[],
  excludedSourceUrls: string[],
  decisions: ReferenceDecision[],
): { referenceImages: ReferenceImage[]; excludedSourceUrls: string[] } {
  const decisionById = new Map(decisions.map((decision) => [decision.id, decision]))
  const updatedImages = referenceImages.map((image) => {
    const decision = decisionById.get(image.id)
    if (!decision) return image
    return { ...image, status: decision.status, rejectReason: decision.rejectReason }
  })
  const newlyRejectedUrls = updatedImages
    .filter((image) => image.status === 'rejected')
    .map((image) => image.sourceUrl)
  const excludedSet = new Set([...excludedSourceUrls, ...newlyRejectedUrls])
  return { referenceImages: updatedImages, excludedSourceUrls: [...excludedSet] }
}

export type ReferenceReviewOutcome = 'proceed' | 'retry' | 'hold-capped' | 'abandon'

export function decideReferenceOutcome(params: {
  referenceImages: ReferenceImage[]
  referenceRound: number
  runStatus: RunStatus
}): ReferenceReviewOutcome {
  const { referenceImages, referenceRound, runStatus } = params
  const allApproved =
    referenceImages.length > 0 && referenceImages.every((image) => image.status === 'approved')
  if (allApproved) return 'proceed'
  if (runStatus === 'capped-references') return 'abandon'
  if (referenceRound >= MAX_ROUNDS) return 'hold-capped'
  return 'retry'
}

export function applyFinalDecision(payload: ResumeFinalPayload): {
  finalStatus: FinalStatus
  finalRejectReason: string | undefined
} {
  return { finalStatus: payload.status, finalRejectReason: payload.rejectReason }
}

export type FinalReviewOutcome = 'done' | 'retry' | 'hold-capped' | 'abandon'

export function decideFinalOutcome(params: {
  finalStatus: FinalStatus
  finalRound: number
  runStatus: RunStatus
}): FinalReviewOutcome {
  const { finalStatus, finalRound, runStatus } = params
  if (finalStatus === 'approved') return 'done'
  if (runStatus === 'capped-final') return 'abandon'
  if (finalRound >= MAX_ROUNDS) return 'hold-capped'
  return 'retry'
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/graph/decisions.test.ts`
Expected: PASS (all 12 cases)

- [ ] **Step 5: Type-check the whole server now that Task 2 and 3 are both in place**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: no errors related to `server/graph/state.ts`'s import of `./decisions.js` types.

- [ ] **Step 6: Commit**

```bash
git add server/graph/decisions.ts server/graph/decisions.test.ts
git commit -m "Add pure decision logic for round-capped review loops"
```

---

## Task 4: Openverse search client

**Files:**
- Create: `server/search/openverse.ts`
- Test: `server/search/openverse.test.ts`

**Interfaces:**
- Produces: `SearchCandidate` type (`{ sourceUrl: string; title?: string }`) and `searchOpenverse(query: string, exclude: string[], limit: number): Promise<SearchCandidate[]>` — consumed by `server/search/index.ts` (Task 6) and `server/search/wikimedia.ts` (Task 5, type only).

- [ ] **Step 1: Write the failing tests**

Create `server/search/openverse.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchOpenverse } from './openverse.js'

describe('searchOpenverse', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns candidates up to the limit, skipping excluded urls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { url: 'https://x/1.jpg', title: 'one' },
          { url: 'https://x/2.jpg', title: 'two' },
          { url: 'https://x/3.jpg', title: 'three' },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const candidates = await searchOpenverse('nasi lemak', ['https://x/2.jpg'], 2)

    expect(candidates).toEqual([
      { sourceUrl: 'https://x/1.jpg', title: 'one' },
      { sourceUrl: 'https://x/3.jpg', title: 'three' },
    ])
    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string)
    expect(requestedUrl.origin + requestedUrl.pathname).toBe('https://api.openverse.org/v1/images/')
    expect(requestedUrl.searchParams.get('q')).toBe('nasi lemak')
  })

  it('returns an empty array when limit is 0 without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await searchOpenverse('nasi lemak', [], 0)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' }))
    await expect(searchOpenverse('nasi lemak', [], 5)).rejects.toThrow('Openverse search failed')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/search/openverse.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `server/search/openverse.ts`**

```ts
export type SearchCandidate = { sourceUrl: string; title?: string }

export async function searchOpenverse(query: string, exclude: string[], limit: number): Promise<SearchCandidate[]> {
  if (limit <= 0) return []
  const excluded = new Set(exclude)
  const url = new URL('https://api.openverse.org/v1/images/')
  url.searchParams.set('q', query)
  url.searchParams.set('page_size', String(Math.min(limit * 3, 20)))
  url.searchParams.set('mature', 'false')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Openverse search failed: ${response.status} ${response.statusText}`)
  }
  const data = (await response.json()) as { results?: Array<{ url?: string; title?: string }> }
  const results = data.results ?? []
  const candidates: SearchCandidate[] = []
  for (const result of results) {
    if (!result.url || excluded.has(result.url)) continue
    candidates.push({ sourceUrl: result.url, title: result.title })
    if (candidates.length >= limit) break
  }
  return candidates
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/search/openverse.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/search/openverse.ts server/search/openverse.test.ts
git commit -m "Add Openverse reference-image search client"
```

---

## Task 5: Wikimedia Commons search client

**Files:**
- Create: `server/search/wikimedia.ts`
- Test: `server/search/wikimedia.test.ts`

**Interfaces:**
- Consumes: `SearchCandidate` type from `server/search/openverse.ts` (Task 4).
- Produces: `searchWikimedia(query: string, exclude: string[], limit: number): Promise<SearchCandidate[]>` — consumed by `server/search/index.ts` (Task 6).

- [ ] **Step 1: Write the failing tests**

Create `server/search/wikimedia.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchWikimedia } from './wikimedia.js'

describe('searchWikimedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('extracts image URLs from the pages response, skipping excluded ones', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: {
          pages: {
            '1': { title: 'File:A.jpg', imageinfo: [{ url: 'https://commons/a.jpg' }] },
            '2': { title: 'File:B.jpg', imageinfo: [{ url: 'https://commons/b.jpg' }] },
          },
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const candidates = await searchWikimedia('nasi lemak', ['https://commons/b.jpg'], 5)

    expect(candidates).toEqual([{ sourceUrl: 'https://commons/a.jpg', title: 'File:A.jpg' }])
    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string)
    expect(requestedUrl.searchParams.get('generator')).toBe('search')
    expect(requestedUrl.searchParams.get('gsrsearch')).toContain('nasi lemak')
  })

  it('returns an empty array when limit is 0 without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await searchWikimedia('nasi lemak', [], 0)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('handles a response with no pages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    expect(await searchWikimedia('nasi lemak', [], 5)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/search/wikimedia.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `server/search/wikimedia.ts`**

```ts
import type { SearchCandidate } from './openverse.js'

export async function searchWikimedia(query: string, exclude: string[], limit: number): Promise<SearchCandidate[]> {
  if (limit <= 0) return []
  const excluded = new Set(exclude)
  const url = new URL('https://commons.wikimedia.org/w/api.php')
  url.searchParams.set('action', 'query')
  url.searchParams.set('generator', 'search')
  url.searchParams.set('gsrsearch', `${query} filetype:bitmap`)
  url.searchParams.set('gsrnamespace', '6')
  url.searchParams.set('gsrlimit', String(Math.min(limit * 3, 20)))
  url.searchParams.set('prop', 'imageinfo')
  url.searchParams.set('iiprop', 'url')
  url.searchParams.set('format', 'json')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Wikimedia search failed: ${response.status} ${response.statusText}`)
  }
  const data = (await response.json()) as {
    query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ url?: string }> }> }
  }
  const pages = Object.values(data.query?.pages ?? {})
  const candidates: SearchCandidate[] = []
  for (const page of pages) {
    const imageUrl = page.imageinfo?.[0]?.url
    if (!imageUrl || excluded.has(imageUrl)) continue
    candidates.push({ sourceUrl: imageUrl, title: page.title })
    if (candidates.length >= limit) break
  }
  return candidates
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/search/wikimedia.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/search/wikimedia.ts server/search/wikimedia.test.ts
git commit -m "Add Wikimedia Commons reference-image search client"
```

---

## Task 6: Combined search + image download

**Files:**
- Create: `server/search/index.ts`
- Create: `server/search/download.ts`
- Test: `server/search/index.test.ts`
- Test: `server/search/download.test.ts`

**Interfaces:**
- Consumes: `searchOpenverse` (Task 4), `searchWikimedia` (Task 5), `SearchCandidate` type.
- Produces: `findReferenceCandidates(query: string, exclude: string[], needed: number): Promise<SearchCandidate[]>` from `server/search/index.ts`, and `downloadImage(url: string, destPath: string): Promise<void>` from `server/search/download.ts` — both consumed by `server/graph/nodes/searchReferences.ts` (Task 10).

- [ ] **Step 1: Write the failing test for combined search**

Create `server/search/index.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { findReferenceCandidates } from './index.js'
import * as openverse from './openverse.js'
import * as wikimedia from './wikimedia.js'

vi.mock('./openverse.js', () => ({ searchOpenverse: vi.fn() }))
vi.mock('./wikimedia.js', () => ({ searchWikimedia: vi.fn() }))

describe('findReferenceCandidates', () => {
  it('returns Openverse results first without calling Wikimedia if enough were found', async () => {
    vi.mocked(openverse.searchOpenverse).mockResolvedValue([
      { sourceUrl: 'https://x/1.jpg' },
      { sourceUrl: 'https://x/2.jpg' },
    ])
    const result = await findReferenceCandidates('nasi lemak', [], 2)
    expect(result).toHaveLength(2)
    expect(wikimedia.searchWikimedia).not.toHaveBeenCalled()
  })

  it('tops up with Wikimedia when Openverse is short', async () => {
    vi.mocked(openverse.searchOpenverse).mockResolvedValue([{ sourceUrl: 'https://x/1.jpg' }])
    vi.mocked(wikimedia.searchWikimedia).mockResolvedValue([{ sourceUrl: 'https://commons/2.jpg' }])
    const result = await findReferenceCandidates('nasi lemak', [], 2)
    expect(result).toEqual([{ sourceUrl: 'https://x/1.jpg' }, { sourceUrl: 'https://commons/2.jpg' }])
  })

  it('returns fewer than needed rather than failing when both sources are short', async () => {
    vi.mocked(openverse.searchOpenverse).mockResolvedValue([])
    vi.mocked(wikimedia.searchWikimedia).mockResolvedValue([])
    const result = await findReferenceCandidates('an extremely obscure dish', [], 5)
    expect(result).toEqual([])
  })

  it('returns an empty array when needed is 0', async () => {
    const result = await findReferenceCandidates('nasi lemak', [], 0)
    expect(result).toEqual([])
    expect(openverse.searchOpenverse).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/search/index.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `server/search/index.ts`**

```ts
import { searchOpenverse, type SearchCandidate } from './openverse.js'
import { searchWikimedia } from './wikimedia.js'

export type { SearchCandidate }

export async function findReferenceCandidates(
  query: string,
  exclude: string[],
  needed: number,
): Promise<SearchCandidate[]> {
  if (needed <= 0) return []
  const seen = new Set(exclude)
  const results: SearchCandidate[] = []

  const fromOpenverse = await searchOpenverse(query, [...seen], needed)
  for (const candidate of fromOpenverse) {
    if (seen.has(candidate.sourceUrl)) continue
    seen.add(candidate.sourceUrl)
    results.push(candidate)
    if (results.length >= needed) return results
  }

  const stillNeeded = needed - results.length
  const fromWikimedia = await searchWikimedia(query, [...seen], stillNeeded)
  for (const candidate of fromWikimedia) {
    if (seen.has(candidate.sourceUrl)) continue
    seen.add(candidate.sourceUrl)
    results.push(candidate)
    if (results.length >= needed) return results
  }

  return results
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/search/index.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for image download**

Create `server/search/download.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { downloadImage } from './download.js'

describe('downloadImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('writes the fetched bytes to destPath, creating directories as needed', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'download-test-'))
    const dest = path.join(dir, 'nested', 'photo.jpg')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode('fake-image-bytes').buffer,
      }),
    )

    await downloadImage('https://example.com/photo.jpg', dest)

    expect((await readFile(dest, 'utf8'))).toBe('fake-image-bytes')
    await rm(dir, { recursive: true, force: true })
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }))
    await expect(downloadImage('https://example.com/missing.jpg', '/tmp/wont-be-written.jpg')).rejects.toThrow(
      'Failed to download image',
    )
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run server/search/download.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 7: Write `server/search/download.ts`**

```ts
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function downloadImage(url: string, destPath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image from ${url}: ${response.status} ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await mkdir(path.dirname(destPath), { recursive: true })
  await writeFile(destPath, buffer)
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run server/search/download.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add server/search/index.ts server/search/download.ts server/search/index.test.ts server/search/download.test.ts
git commit -m "Add combined reference search and image download"
```

---

## Task 7: Generic Cursor Agent wrapper

**Files:**
- Create: `server/agents/cursorAgent.ts`
- Test: `server/agents/cursorAgent.test.ts`

**Interfaces:**
- Consumes: `REPO_ROOT` from `server/env.ts` (Task 1); `Agent` from `@cursor/sdk`.
- Produces: `toRepoRelative(absolutePath: string): string`, `runCursorAgent(params: { apiKey, systemPrompt, task, timeoutMs? }): Promise<void>`, `waitForFile(absolutePath: string, timeoutMs?: number): Promise<void>` — consumed by `server/agents/screenReferences.ts`, `server/agents/writeGenerationPrompt.ts`, `server/agents/generateImage.ts` (Task 9).

- [ ] **Step 1: Write the failing tests**

Create `server/agents/cursorAgent.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Agent } from '@cursor/sdk'
import { runCursorAgent, toRepoRelative, waitForFile } from './cursorAgent.js'

vi.mock('@cursor/sdk', () => ({
  Agent: { create: vi.fn() },
}))

describe('runCursorAgent', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends the combined system prompt and task, then disposes the agent', async () => {
    const send = vi.fn().mockResolvedValue({ wait: () => Promise.resolve({ status: 'completed', id: 'r1' }) })
    const dispose = vi.fn().mockResolvedValue(undefined)
    vi.mocked(Agent.create).mockResolvedValue({ send, close: vi.fn(), [Symbol.asyncDispose]: dispose } as never)

    await runCursorAgent({ apiKey: 'k', systemPrompt: 'sys', task: 'do it' })

    expect(send).toHaveBeenCalledWith('sys\n\n---\n\ndo it')
    expect(dispose).toHaveBeenCalled()
  })

  it('throws when the run status is error', async () => {
    const send = vi.fn().mockResolvedValue({ wait: () => Promise.resolve({ status: 'error', id: 'r2' }) })
    vi.mocked(Agent.create).mockResolvedValue({
      send,
      close: vi.fn(),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    } as never)

    await expect(runCursorAgent({ apiKey: 'k', systemPrompt: 'sys', task: 'do it' })).rejects.toThrow(
      'Cursor agent run failed (r2)',
    )
  })

  it('disposes the agent even when send() throws', async () => {
    const dispose = vi.fn().mockResolvedValue(undefined)
    vi.mocked(Agent.create).mockResolvedValue({
      send: vi.fn().mockRejectedValue(new Error('network down')),
      close: vi.fn(),
      [Symbol.asyncDispose]: dispose,
    } as never)

    await expect(runCursorAgent({ apiKey: 'k', systemPrompt: 'sys', task: 'do it' })).rejects.toThrow('network down')
    expect(dispose).toHaveBeenCalled()
  })

  it('times out if the run never resolves', async () => {
    const send = vi.fn().mockResolvedValue({ wait: () => new Promise(() => {}) })
    vi.mocked(Agent.create).mockResolvedValue({
      send,
      close: vi.fn(),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    } as never)

    await expect(
      runCursorAgent({ apiKey: 'k', systemPrompt: 'sys', task: 'do it', timeoutMs: 50 }),
    ).rejects.toThrow('timed out')
  })
})

describe('waitForFile', () => {
  it('resolves once the file appears', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cursor-agent-test-'))
    const target = path.join(dir, 'out.txt')
    setTimeout(() => {
      void writeFile(target, 'done')
    }, 100)

    await expect(waitForFile(target, 2_000)).resolves.toBeUndefined()
    await rm(dir, { recursive: true, force: true })
  })

  it('rejects if the file never appears within the timeout', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cursor-agent-test-'))
    const target = path.join(dir, 'missing.txt')
    await expect(waitForFile(target, 300)).rejects.toThrow('Timed out waiting for file')
    await rm(dir, { recursive: true, force: true })
  })
})

describe('toRepoRelative', () => {
  it('returns a path relative to the repo root', () => {
    const abs = path.join(process.cwd(), 'runs', 'abc', 'references', 'a.jpg')
    expect(toRepoRelative(abs)).toBe(path.join('runs', 'abc', 'references', 'a.jpg'))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/agents/cursorAgent.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `server/agents/cursorAgent.ts`**

```ts
import path from 'node:path'
import { stat } from 'node:fs/promises'
import { Agent } from '@cursor/sdk'
import { REPO_ROOT } from '../env.js'

const MODEL = { id: 'composer-2.5' } as const

export function toRepoRelative(absolutePath: string): string {
  return path.relative(REPO_ROOT, absolutePath)
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

export async function runCursorAgent(params: {
  apiKey: string
  systemPrompt: string
  task: string
  timeoutMs?: number
}): Promise<void> {
  const { apiKey, systemPrompt, task, timeoutMs = 180_000 } = params
  const agent = await Agent.create({ apiKey, model: MODEL, local: { cwd: REPO_ROOT } })
  try {
    const run = await agent.send(`${systemPrompt}\n\n---\n\n${task}`)
    const result = await withTimeout(run.wait(), timeoutMs, `Cursor agent run timed out after ${timeoutMs}ms`)
    if (result.status === 'error') {
      throw new Error(`Cursor agent run failed (${result.id})`)
    }
  } finally {
    try {
      await agent[Symbol.asyncDispose]()
    } catch {
      agent.close()
    }
  }
}

export async function waitForFile(absolutePath: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await stat(absolutePath)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw new Error(`Timed out waiting for file: ${absolutePath}`)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/agents/cursorAgent.test.ts`
Expected: PASS (7 cases)

- [ ] **Step 5: Commit**

```bash
git add server/agents/cursorAgent.ts server/agents/cursorAgent.test.ts
git commit -m "Add generic Cursor Agent wrapper with timeout and file-wait helpers"
```

---

## Task 8: Prompt assets + loader

**Files:**
- Create: `server/prompts/anti-slop-guidance.md`
- Create: `server/prompts/screen-references.md`
- Create: `server/prompts/write-generation-prompt.md`
- Create: `server/prompts/generate-image.md`
- Create: `server/prompts/loadPrompt.ts`
- Test: `server/prompts/loadPrompt.test.ts`

**Interfaces:**
- Produces: `loadRolePrompt(role: 'screen-references' | 'write-generation-prompt' | 'generate-image'): Promise<string>` — consumed by `server/agents/screenReferences.ts`, `server/agents/writeGenerationPrompt.ts`, `server/agents/generateImage.ts` (Task 9).

- [ ] **Step 1: Write `server/prompts/anti-slop-guidance.md`**

```md
# Anti-slop guidance

Core principle: if a human food photographer would not take the shot this
way, don't generate it this way. Real food photography has physical logic,
imperfection, and a specific cooking/plating stage; AI slop ignores all
three.

## Prompt scaffold

Build any generation prompt from these parts, in order:
1. Stage-specific description of the dish (finished plated state, exact
   garnish/components) — not a generic "delicious food" description.
2. Material/texture cues — e.g. piece sizes vary 15-30%, matte patches next
   to glossy ones, sauce pooling thicker in some spots with a thin oil
   sheen, not uniform gloss.
3. Light direction — one consistent, physically plausible source (e.g. soft
   natural light from the left, a slight hot spot, asymmetric shadow
   falloff).
4. Camera style — e.g. 50mm lens, shallow but slightly uneven depth-of-field
   falloff, a touch of sensor grain, faint chromatic aberration at
   high-contrast edges.
5. Explicit negatives — no identical pieces/dice, no radial or symmetrical
   plating, no algorithmic garnish scatter, no thick centered steam plume,
   no tiled/repeating background texture, no plastic texture, no
   oversaturation, no floating ingredients, no readable label text or logos.

## Hard avoid list

- Waxy, glossy, airbrushed food; plastic or rubbery textures; perfectly
  uniform browning or mincing.
- Oversaturated/neon colors; a single AI color-grade skew (heavy
  teal-orange, all-amber, magenta-cyan).
- Steam or liquids defying physics (symmetrical plumes, drips that don't
  pool, sauce frozen mid-air); duplicated or floating garnish.
- Malformed hands/utensils; wrong proportions (pan vs. stove, portion vs.
  plate).
- Radial/symmetrical plating; studio-perfect crumbs or garnish rings;
  repeating/tiled background patterns.
- Readable text, logos, or watermarks on packaging or dishware.
- Product-shot-perfect uniform lighting with no natural asymmetry.

## Appetite checklist

Before accepting a generation prompt or a generated image, it should pass:
food looks edible (not a render); textures are visually distinguishable;
colors are warm/natural and match real ingredient colors; composition draws
the eye to the food; no artifacts (melted utensils, extra limbs, garbled
text, impossible physics); natural irregularity is visible (varied piece
sizes, hand-scattered garnish, uneven sauce pooling, non-perfect lighting).
```

- [ ] **Step 2: Write `server/prompts/screen-references.md`**

```md
# Role: screen reference photos

You are screening candidate real-world food photos found on the web. You do
not decide accept/reject — a human makes that call. Your job is to write one
short, specific note per photo that helps the human decide quickly.

For each candidate photo, look for the same tells listed in the hard avoid
list and the few-shot slop examples: does it look like an actual photograph
(camera noise, natural asymmetry, real texture) or does it look
AI-generated (waxy textures, too-perfect symmetry, garbled text, physics
violations)? Also note whether the dish shown actually matches the prompt.

Write one line per image: a real/likely-AI-generated call, plus a relevance
call, plus the single most telling visual detail either way. Do not hedge
with "possibly" — pick the more likely explanation.
```

- [ ] **Step 3: Write `server/prompts/write-generation-prompt.md`**

```md
# Role: write the generation prompt

You write the prompt that a separate image-generation step will use
verbatim. You do not generate images yourself.

Look closely at the approved reference photos you're given — real textures,
plating style, garnish, lighting — and ground your prompt in what you
actually observe in them, not in a generic mental image of the dish. Follow
the prompt scaffold exactly (stage-specific description, material/texture
cues, light direction, camera style, explicit negatives).

If you're given a rejection reason from a previous attempt, treat it as a
required fix, not a suggestion — change the prompt so that failure cannot
recur.

Write only the finished prompt text to the requested output file. No
preamble, no explanation, no markdown formatting — just the prompt itself.
```

- [ ] **Step 4: Write `server/prompts/generate-image.md`**

```md
# Role: generate the image

You are given a finished, already-written image-generation prompt. Generate
a 16:9 photorealistic image using the GenerateImage tool with that exact
prompt — do not rewrite, shorten, or "improve" it. Save (or copy) the
resulting image file to the exact path you're given.
```

- [ ] **Step 5: Write the failing test for the loader**

Create `server/prompts/loadPrompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { loadRolePrompt } from './loadPrompt.js'

describe('loadRolePrompt', () => {
  it('includes the anti-slop guidance and the few-shot examples pointer for screen-references', async () => {
    const prompt = await loadRolePrompt('screen-references')
    expect(prompt).toContain('screening candidate real-world food photos')
    expect(prompt).toContain('radial or symmetrical')
    expect(prompt).toContain('ai-slop-examples/annotations.md')
  })

  it('includes the anti-slop guidance for write-generation-prompt', async () => {
    const prompt = await loadRolePrompt('write-generation-prompt')
    expect(prompt).toContain('You write the prompt')
    expect(prompt).toContain('Appetite checklist')
  })

  it('does not include anti-slop guidance for generate-image', async () => {
    const prompt = await loadRolePrompt('generate-image')
    expect(prompt).toContain('GenerateImage tool')
    expect(prompt).not.toContain('Appetite checklist')
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run server/prompts/loadPrompt.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 7: Write `server/prompts/loadPrompt.ts`**

```ts
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const PROMPTS_DIR = import.meta.dirname

const ANTI_SLOP_ROLES = new Set(['screen-references', 'write-generation-prompt'])

export type PromptRole = 'screen-references' | 'write-generation-prompt' | 'generate-image'

export async function loadRolePrompt(role: PromptRole): Promise<string> {
  const roleText = await readFile(path.join(PROMPTS_DIR, `${role}.md`), 'utf8')
  if (!ANTI_SLOP_ROLES.has(role)) return roleText
  const guidance = await readFile(path.join(PROMPTS_DIR, 'anti-slop-guidance.md'), 'utf8')
  const examplesNote =
    'Before judging or writing, read the few-shot AI-slop examples and explanations in ' +
    'server/prompts/ai-slop-examples/annotations.md and the images alongside it — use them ' +
    'to calibrate what "AI slop" looks like.'
  return [roleText, guidance, examplesNote].join('\n\n---\n\n')
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run server/prompts/loadPrompt.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add server/prompts/anti-slop-guidance.md server/prompts/screen-references.md server/prompts/write-generation-prompt.md server/prompts/generate-image.md server/prompts/loadPrompt.ts server/prompts/loadPrompt.test.ts
git commit -m "Add role prompts and anti-slop guidance loader"
```

---

## Task 9: Agent role functions

**Files:**
- Create: `server/agents/screenReferences.ts`
- Create: `server/agents/writeGenerationPrompt.ts`
- Create: `server/agents/generateImage.ts`
- Test: `server/agents/screenReferences.test.ts`
- Test: `server/agents/writeGenerationPrompt.test.ts`
- Test: `server/agents/generateImage.test.ts`

**Interfaces:**
- Consumes: `runCursorAgent`, `waitForFile`, `toRepoRelative` from `server/agents/cursorAgent.ts` (Task 7); `loadRolePrompt` from `server/prompts/loadPrompt.ts` (Task 8); `ReferenceImage` from `shared/types.ts` (Task 2).
- Produces: `screenReferenceImages(params): Promise<Record<string, string>>`, `writeGenerationPrompt(params): Promise<string>`, `generateFoodImage(params): Promise<void>` — consumed by `server/graph/nodes/screenReferences.ts` (Task 11), `server/graph/nodes/writeGenerationPrompt.ts` and `server/graph/nodes/generateImage.ts` (Task 13).

- [ ] **Step 1: Write the failing test for `screenReferenceImages`**

Create `server/agents/screenReferences.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as cursorAgent from './cursorAgent.js'
import { screenReferenceImages } from './screenReferences.js'

vi.mock('./cursorAgent.js', async () => {
  const actual = await vi.importActual<typeof import('./cursorAgent.js')>('./cursorAgent.js')
  return { ...actual, runCursorAgent: vi.fn() }
})

describe('screenReferenceImages', () => {
  it('returns {} without calling the agent when there is nothing to screen', async () => {
    const result = await screenReferenceImages({ apiKey: 'k', prompt: 'nasi lemak', images: [], notesPath: '/tmp/notes.json' })
    expect(result).toEqual({})
    expect(cursorAgent.runCursorAgent).not.toHaveBeenCalled()
  })

  it('reads back the notes file the agent is instructed to write', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'screen-refs-'))
    const notesPath = path.join(dir, 'notes.json')
    vi.mocked(cursorAgent.runCursorAgent).mockImplementation(async () => {
      await writeFile(notesPath, JSON.stringify({ a: 'looks real' }))
    })

    const result = await screenReferenceImages({
      apiKey: 'k',
      prompt: 'nasi lemak',
      images: [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: path.join(dir, 'a.jpg'), status: 'pending' }],
      notesPath,
    })

    expect(result).toEqual({ a: 'looks real' })
    await rm(dir, { recursive: true, force: true })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/agents/screenReferences.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `server/agents/screenReferences.ts`**

```ts
import { readFile } from 'node:fs/promises'
import { runCursorAgent, toRepoRelative, waitForFile } from './cursorAgent.js'
import { loadRolePrompt } from '../prompts/loadPrompt.js'
import type { ReferenceImage } from '../../shared/types.js'

export async function screenReferenceImages(params: {
  apiKey: string
  prompt: string
  images: ReferenceImage[]
  notesPath: string
}): Promise<Record<string, string>> {
  const { apiKey, prompt, images, notesPath } = params
  if (images.length === 0) return {}
  const systemPrompt = await loadRolePrompt('screen-references')
  const task = [
    `Dish prompt: "${prompt}"`,
    '',
    `Write your findings as JSON to: ${toRepoRelative(notesPath)}`,
    'Judge exactly these candidate photos:',
    ...images.map((image) => `- ${toRepoRelative(image.localPath)} (id: ${image.id})`),
    '',
    'Output shape: { "<id>": "<one-line note>", ... } — one entry for every id listed above.',
  ].join('\n')
  await runCursorAgent({ apiKey, systemPrompt, task })
  await waitForFile(notesPath)
  const raw = await readFile(notesPath, 'utf8')
  return JSON.parse(raw) as Record<string, string>
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/agents/screenReferences.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for `writeGenerationPrompt`**

Create `server/agents/writeGenerationPrompt.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as cursorAgent from './cursorAgent.js'
import { writeGenerationPrompt } from './writeGenerationPrompt.js'

vi.mock('./cursorAgent.js', async () => {
  const actual = await vi.importActual<typeof import('./cursorAgent.js')>('./cursorAgent.js')
  return { ...actual, runCursorAgent: vi.fn() }
})

describe('writeGenerationPrompt', () => {
  it('reads back the prompt file the agent is instructed to write', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'write-prompt-'))
    const outputPath = path.join(dir, 'prompt.txt')
    vi.mocked(cursorAgent.runCursorAgent).mockImplementation(async () => {
      await writeFile(outputPath, 'a very detailed prompt\n')
    })

    const result = await writeGenerationPrompt({
      apiKey: 'k',
      prompt: 'nasi lemak with fried chicken',
      approvedImages: [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: path.join(dir, 'a.jpg'), status: 'approved' }],
      outputPath,
    })

    expect(result).toBe('a very detailed prompt')
    await rm(dir, { recursive: true, force: true })
  })

  it('includes the rejection reason in the task text on a retry', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'write-prompt-'))
    const outputPath = path.join(dir, 'prompt.txt')
    vi.mocked(cursorAgent.runCursorAgent).mockImplementation(async () => {
      await writeFile(outputPath, 'a fixed prompt')
    })

    await writeGenerationPrompt({
      apiKey: 'k',
      prompt: 'nasi lemak',
      approvedImages: [],
      finalRejectReason: 'too glossy',
      outputPath,
    })

    const task = vi.mocked(cursorAgent.runCursorAgent).mock.calls[0][0].task
    expect(task).toContain('too glossy')
    await rm(dir, { recursive: true, force: true })
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run server/agents/writeGenerationPrompt.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 7: Write `server/agents/writeGenerationPrompt.ts`**

```ts
import { readFile } from 'node:fs/promises'
import { runCursorAgent, toRepoRelative, waitForFile } from './cursorAgent.js'
import { loadRolePrompt } from '../prompts/loadPrompt.js'
import type { ReferenceImage } from '../../shared/types.js'

export async function writeGenerationPrompt(params: {
  apiKey: string
  prompt: string
  approvedImages: ReferenceImage[]
  finalRejectReason?: string
  outputPath: string
}): Promise<string> {
  const { apiKey, prompt, approvedImages, finalRejectReason, outputPath } = params
  const systemPrompt = await loadRolePrompt('write-generation-prompt')
  const task = [
    `Dish prompt: "${prompt}"`,
    '',
    'Approved reference photos (ground your prompt in what you actually see in these):',
    ...approvedImages.map((image) => `- ${toRepoRelative(image.localPath)}`),
    '',
    finalRejectReason
      ? `The previous generated image was rejected for this reason — fix it: ${finalRejectReason}`
      : '',
    '',
    `Write the final image-generation prompt as plain text to: ${toRepoRelative(outputPath)}`,
  ]
    .filter((line) => line !== '')
    .join('\n')
  await runCursorAgent({ apiKey, systemPrompt, task })
  await waitForFile(outputPath)
  return (await readFile(outputPath, 'utf8')).trim()
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run server/agents/writeGenerationPrompt.test.ts`
Expected: PASS

- [ ] **Step 9: Write the failing test for `generateFoodImage`**

Create `server/agents/generateImage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as cursorAgent from './cursorAgent.js'
import { generateFoodImage } from './generateImage.js'

vi.mock('./cursorAgent.js', async () => {
  const actual = await vi.importActual<typeof import('./cursorAgent.js')>('./cursorAgent.js')
  return { ...actual, runCursorAgent: vi.fn() }
})

describe('generateFoodImage', () => {
  it('waits for the output file the agent is instructed to write', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'generate-image-'))
    const outputPath = path.join(dir, 'attempt-0.png')
    vi.mocked(cursorAgent.runCursorAgent).mockImplementation(async () => {
      await writeFile(outputPath, 'fake-png-bytes')
    })

    await generateFoodImage({ apiKey: 'k', generationPrompt: 'a very detailed prompt', outputPath })

    const task = vi.mocked(cursorAgent.runCursorAgent).mock.calls[0][0].task
    expect(task).toContain('a very detailed prompt')
    await rm(dir, { recursive: true, force: true })
  })

  it('propagates an error if the agent never produces the file', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'generate-image-'))
    const outputPath = path.join(dir, 'never-written.png')
    vi.mocked(cursorAgent.runCursorAgent).mockResolvedValue(undefined)

    await expect(
      generateFoodImage({ apiKey: 'k', generationPrompt: 'x', outputPath, timeoutMs: 200 }),
    ).rejects.toThrow('Timed out waiting for file')
    await rm(dir, { recursive: true, force: true })
  })
})
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `npx vitest run server/agents/generateImage.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 11: Write `server/agents/generateImage.ts`**

```ts
import { runCursorAgent, toRepoRelative, waitForFile } from './cursorAgent.js'
import { loadRolePrompt } from '../prompts/loadPrompt.js'

export async function generateFoodImage(params: {
  apiKey: string
  generationPrompt: string
  outputPath: string
  timeoutMs?: number
}): Promise<void> {
  const { apiKey, generationPrompt, outputPath, timeoutMs = 15_000 } = params
  const systemPrompt = await loadRolePrompt('generate-image')
  const task = [
    'Generate a 16:9 photorealistic image using the GenerateImage tool for this exact prompt:',
    '',
    generationPrompt,
    '',
    `Save (or copy) the resulting PNG to: ${toRepoRelative(outputPath)}`,
  ].join('\n')
  await runCursorAgent({ apiKey, systemPrompt, task, timeoutMs: 240_000 })
  await waitForFile(outputPath, timeoutMs)
}
```

Note: `timeoutMs` here controls only the `waitForFile` poll (defaulted low for the test above); the Cursor agent call itself always gets a generous fixed 240s budget since image generation is the slowest step. This is intentional — the test's short `timeoutMs: 200` exercises the file-wait timeout without waiting 240 real seconds for the agent-call timeout.

- [ ] **Step 12: Run the test to verify it passes**

Run: `npx vitest run server/agents/generateImage.test.ts`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add server/agents/screenReferences.ts server/agents/writeGenerationPrompt.ts server/agents/generateImage.ts server/agents/screenReferences.test.ts server/agents/writeGenerationPrompt.test.ts server/agents/generateImage.test.ts
git commit -m "Add Cursor agent role functions for screening, prompt-writing, and generation"
```

---

## Task 10: `searchReferences` graph node

**Files:**
- Create: `server/graph/nodes/searchReferences.ts`
- Test: `server/graph/nodes/searchReferences.test.ts`

**Interfaces:**
- Consumes: `findReferenceCandidates` from `server/search/index.ts` (Task 6), `downloadImage` from `server/search/download.ts` (Task 6), `runDir` from `server/env.ts` (Task 2), `GraphState` from `server/graph/state.ts` (Task 2).
- Produces: `searchReferences(state: GraphState): Promise<Partial<GraphState>>` — consumed by `server/graph/build.ts` (Task 15).

This node keeps only `approved` images from the incoming state and tops the total back up to 5 with freshly downloaded candidates (rejected images are dropped from the live array once `excludedSourceUrls` has recorded their URL — see Task 3's `applyReferenceDecisions`).

- [ ] **Step 1: Write the failing tests**

Create `server/graph/nodes/searchReferences.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { searchReferences } from './searchReferences.js'
import * as searchIndex from '../../search/index.js'
import * as download from '../../search/download.js'
import { createInitialState } from '../state.js'

vi.mock('../../search/index.js', () => ({ findReferenceCandidates: vi.fn() }))
vi.mock('../../search/download.js', () => ({ downloadImage: vi.fn() }))

describe('searchReferences', () => {
  it('fetches 5 candidates and downloads each when there are no approved images yet', async () => {
    vi.mocked(searchIndex.findReferenceCandidates).mockResolvedValue(
      Array.from({ length: 5 }, (_v, i) => ({ sourceUrl: `https://x/${i}.jpg` })),
    )
    vi.mocked(download.downloadImage).mockResolvedValue(undefined)

    const state = createInitialState('run-1', 'nasi lemak')
    const result = await searchReferences(state)

    expect(searchIndex.findReferenceCandidates).toHaveBeenCalledWith('nasi lemak', [], 5)
    expect(result.referenceImages).toHaveLength(5)
    expect(result.referenceImages?.every((image) => image.status === 'pending')).toBe(true)
    expect(download.downloadImage).toHaveBeenCalledTimes(5)
  })

  it('keeps approved images and only tops up the remainder', async () => {
    vi.mocked(searchIndex.findReferenceCandidates).mockResolvedValue([{ sourceUrl: 'https://x/new.jpg' }])
    vi.mocked(download.downloadImage).mockResolvedValue(undefined)

    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = [
      { id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'approved' },
    ]
    state.excludedSourceUrls = ['https://x/rejected.jpg']

    const result = await searchReferences(state)

    expect(searchIndex.findReferenceCandidates).toHaveBeenCalledWith('nasi lemak', ['https://x/rejected.jpg'], 4)
    expect(result.referenceImages).toHaveLength(2)
    expect(result.referenceImages?.[0]).toMatchObject({ id: 'a', status: 'approved' })
  })

  it('does not call search when 5 images are already approved', async () => {
    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = Array.from({ length: 5 }, (_v, i) => ({
      id: `a${i}`,
      sourceUrl: `https://x/${i}.jpg`,
      localPath: `/tmp/${i}.jpg`,
      status: 'approved' as const,
    }))

    const result = await searchReferences(state)

    expect(searchIndex.findReferenceCandidates).not.toHaveBeenCalled()
    expect(result.referenceImages).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/graph/nodes/searchReferences.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `server/graph/nodes/searchReferences.ts`**

```ts
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { findReferenceCandidates } from '../../search/index.js'
import { downloadImage } from '../../search/download.js'
import { runDir } from '../../env.js'
import type { GraphState } from '../state.js'

const TARGET_COUNT = 5

export async function searchReferences(state: GraphState): Promise<Partial<GraphState>> {
  const approved = state.referenceImages.filter((image) => image.status === 'approved')
  const needed = Math.max(0, TARGET_COUNT - approved.length)
  if (needed === 0) {
    return { referenceImages: approved }
  }

  const candidates = await findReferenceCandidates(state.prompt, state.excludedSourceUrls, needed)
  const referencesDir = path.join(runDir(state.runId), 'references')
  const downloaded = await Promise.all(
    candidates.map(async (candidate) => {
      const id = randomUUID()
      const ext = path.extname(new URL(candidate.sourceUrl).pathname) || '.jpg'
      const localPath = path.join(referencesDir, `${id}${ext}`)
      await downloadImage(candidate.sourceUrl, localPath)
      return { id, sourceUrl: candidate.sourceUrl, localPath, status: 'pending' as const }
    }),
  )

  return { referenceImages: [...approved, ...downloaded] }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/graph/nodes/searchReferences.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/graph/nodes/searchReferences.ts server/graph/nodes/searchReferences.test.ts
git commit -m "Add searchReferences graph node"
```

---

## Task 11: `screenReferences` graph node

**Files:**
- Create: `server/graph/nodes/screenReferences.ts`
- Test: `server/graph/nodes/screenReferences.test.ts`

**Interfaces:**
- Consumes: `screenReferenceImages` from `server/agents/screenReferences.ts` (Task 9), `getCursorApiKey`, `runDir` from `server/env.ts`, `GraphState` from `server/graph/state.ts`.
- Produces: `screenReferencesNode(state: GraphState): Promise<Partial<GraphState>>` — consumed by `server/graph/build.ts` (Task 15). Always sets `runStatus: 'paused-references'`, since the very next node in the graph is the `reviewReferences` interrupt.

- [ ] **Step 1: Write the failing tests**

Create `server/graph/nodes/screenReferences.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { screenReferencesNode } from './screenReferences.js'
import * as screenAgent from '../../agents/screenReferences.js'
import { createInitialState } from '../state.js'

vi.mock('../../agents/screenReferences.js', () => ({ screenReferenceImages: vi.fn() }))
vi.mock('../../env.js', async () => {
  const actual = await vi.importActual<typeof import('../../env.js')>('../../env.js')
  return { ...actual, getCursorApiKey: () => 'test-key' }
})

describe('screenReferencesNode', () => {
  it('merges notes into unscreened images and marks the run paused-references', async () => {
    vi.mocked(screenAgent.screenReferenceImages).mockResolvedValue({ a: 'looks real' })
    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'pending' }]

    const result = await screenReferencesNode(state)

    expect(result.referenceImages?.[0].cursorNote).toBe('looks real')
    expect(result.runStatus).toBe('paused-references')
  })

  it('skips already-screened images and still marks paused-references when nothing new needs screening', async () => {
    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = [
      { id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'approved', cursorNote: 'already noted' },
    ]

    const result = await screenReferencesNode(state)

    expect(screenAgent.screenReferenceImages).not.toHaveBeenCalled()
    expect(result.runStatus).toBe('paused-references')
    expect(result.referenceImages).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/graph/nodes/screenReferences.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `server/graph/nodes/screenReferences.ts`**

```ts
import path from 'node:path'
import { screenReferenceImages } from '../../agents/screenReferences.js'
import { getCursorApiKey, runDir } from '../../env.js'
import type { GraphState } from '../state.js'

export async function screenReferencesNode(state: GraphState): Promise<Partial<GraphState>> {
  const unscreened = state.referenceImages.filter((image) => image.cursorNote === undefined)
  if (unscreened.length === 0) {
    return { runStatus: 'paused-references' }
  }

  const notesPath = path.join(runDir(state.runId), 'references', 'notes.json')
  const notes = await screenReferenceImages({
    apiKey: getCursorApiKey(),
    prompt: state.prompt,
    images: unscreened,
    notesPath,
  })

  const referenceImages = state.referenceImages.map((image) =>
    notes[image.id] ? { ...image, cursorNote: notes[image.id] } : image,
  )
  return { referenceImages, runStatus: 'paused-references' }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/graph/nodes/screenReferences.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/graph/nodes/screenReferences.ts server/graph/nodes/screenReferences.test.ts
git commit -m "Add screenReferences graph node"
```

---

## Task 12: `reviewReferences` interrupt node + router

**Files:**
- Create: `server/graph/nodes/reviewReferences.ts`
- Create: `server/graph/routers.ts` (partial — `routeAfterReviewReferences` only; `routeAfterReviewFinal` is added in Task 14)
- Test: `server/graph/nodes/reviewReferences.test.ts`

**Interfaces:**
- Consumes: `interrupt` from `@langchain/langgraph`; `applyReferenceDecisions`, `decideReferenceOutcome` from `server/graph/decisions.ts` (Task 3); `GraphState` from `server/graph/state.ts`; `ResumeReferencesPayload`, `ReferenceImage` from `shared/types.ts`.
- Produces: `reviewReferences(state: GraphState): Promise<Partial<GraphState>>` and `routeAfterReviewReferences(state: GraphState): 'searchReferences' | 'writeGenerationPrompt' | 'reviewReferences' | typeof END` — both consumed by `server/graph/build.ts` (Task 15).

This is the first task that exercises LangGraph's actual interrupt/resume mechanics, so it's tested with a small standalone graph rather than mocks.

- [ ] **Step 1: Write the failing test**

Create `server/graph/nodes/reviewReferences.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { StateGraph, START, END, MemorySaver, Command } from '@langchain/langgraph'
import { RunAnnotation, createInitialState } from '../state.js'
import { reviewReferences } from './reviewReferences.js'

function buildTestGraph() {
  return new StateGraph(RunAnnotation)
    .addNode('reviewReferences', reviewReferences)
    .addEdge(START, 'reviewReferences')
    .addEdge('reviewReferences', END)
    .compile({ checkpointer: new MemorySaver() })
}

describe('reviewReferences', () => {
  it('pauses with the current images and resumes to proceed when all approved', async () => {
    const graph = buildTestGraph()
    const config = { configurable: { thread_id: 't1' } }
    const initial = createInitialState('run-1', 'nasi lemak')
    initial.referenceImages = [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'pending' }]

    await graph.invoke(initial, config)
    const paused = await graph.getState(config)
    expect(paused.next).toEqual(['reviewReferences'])
    expect(paused.tasks[0].interrupts[0].value).toMatchObject({ type: 'references', capped: false })

    await graph.invoke(new Command({ resume: { decisions: [{ id: 'a', status: 'approved' }] } }), config)
    const finished = await graph.getState(config)
    expect(finished.values.referenceImages[0].status).toBe('approved')
    expect(finished.values.runStatus).toBe('working')
    expect(finished.values.lastReferenceOutcome).toBe('proceed')
  })

  it('increments the round and stays working on a retry decision', async () => {
    const graph = buildTestGraph()
    const config = { configurable: { thread_id: 't2' } }
    const initial = createInitialState('run-2', 'nasi lemak')
    initial.referenceImages = [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'pending' }]

    await graph.invoke(initial, config)
    await graph.invoke(
      new Command({ resume: { decisions: [{ id: 'a', status: 'rejected', rejectReason: 'AI-looking' }] } }),
      config,
    )
    const finished = await graph.getState(config)
    expect(finished.values.referenceRound).toBe(1)
    expect(finished.values.runStatus).toBe('working')
    expect(finished.values.lastReferenceOutcome).toBe('retry')
    expect(finished.values.excludedSourceUrls).toEqual(['https://x/a.jpg'])
  })

  it('abandons when already capped and rejected again', async () => {
    const graph = buildTestGraph()
    const config = { configurable: { thread_id: 't3' } }
    const initial = createInitialState('run-3', 'nasi lemak')
    initial.referenceImages = [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'pending' }]
    initial.referenceRound = 5
    initial.runStatus = 'capped-references'

    await graph.invoke(initial, config)
    await graph.invoke(
      new Command({ resume: { decisions: [{ id: 'a', status: 'rejected', rejectReason: 'still bad' }] } }),
      config,
    )
    const finished = await graph.getState(config)
    expect(finished.values.runStatus).toBe('abandoned')
    expect(finished.values.lastReferenceOutcome).toBe('abandon')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/graph/nodes/reviewReferences.test.ts`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Write `server/graph/nodes/reviewReferences.ts`**

```ts
import { interrupt } from '@langchain/langgraph'
import { applyReferenceDecisions, decideReferenceOutcome } from '../decisions.js'
import type { GraphState } from '../state.js'
import type { ReferenceImage, ResumeReferencesPayload } from '../../../shared/types.js'

type ReferencesInterruptValue = { type: 'references'; images: ReferenceImage[]; capped: boolean }

export async function reviewReferences(state: GraphState): Promise<Partial<GraphState>> {
  const payload = interrupt<ReferencesInterruptValue, ResumeReferencesPayload>({
    type: 'references',
    images: state.referenceImages,
    capped: state.runStatus === 'capped-references',
  })

  const { referenceImages, excludedSourceUrls } = applyReferenceDecisions(
    state.referenceImages,
    state.excludedSourceUrls,
    payload.decisions,
  )
  const outcome = decideReferenceOutcome({
    referenceImages,
    referenceRound: state.referenceRound,
    runStatus: state.runStatus,
  })

  if (outcome === 'proceed') {
    return { referenceImages, excludedSourceUrls, runStatus: 'working', lastReferenceOutcome: outcome }
  }
  if (outcome === 'retry') {
    return {
      referenceImages,
      excludedSourceUrls,
      referenceRound: state.referenceRound + 1,
      runStatus: 'working',
      lastReferenceOutcome: outcome,
    }
  }
  if (outcome === 'hold-capped') {
    return { referenceImages, excludedSourceUrls, runStatus: 'capped-references', lastReferenceOutcome: outcome }
  }
  return { referenceImages, excludedSourceUrls, runStatus: 'abandoned', lastReferenceOutcome: outcome }
}
```

- [ ] **Step 4: Write `server/graph/routers.ts`**

```ts
import { END } from '@langchain/langgraph'
import type { GraphState } from './state.js'

export function routeAfterReviewReferences(
  state: GraphState,
): 'searchReferences' | 'writeGenerationPrompt' | 'reviewReferences' | typeof END {
  switch (state.lastReferenceOutcome) {
    case 'proceed':
      return 'writeGenerationPrompt'
    case 'retry':
      return 'searchReferences'
    case 'hold-capped':
      return 'reviewReferences'
    case 'abandon':
      return END
    default:
      return 'searchReferences'
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run server/graph/nodes/reviewReferences.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/graph/nodes/reviewReferences.ts server/graph/routers.ts server/graph/nodes/reviewReferences.test.ts
git commit -m "Add reviewReferences interrupt node and its router"
```

---

## Task 13: `writeGenerationPrompt` and `generateImage` graph nodes

**Files:**
- Create: `server/graph/nodes/writeGenerationPrompt.ts`
- Create: `server/graph/nodes/generateImage.ts`
- Test: `server/graph/nodes/writeGenerationPrompt.test.ts`
- Test: `server/graph/nodes/generateImage.test.ts`

**Interfaces:**
- Consumes: `writeGenerationPrompt` (agent function) from `server/agents/writeGenerationPrompt.ts`, `generateFoodImage` from `server/agents/generateImage.ts` (Task 9); `getCursorApiKey`, `runDir` from `server/env.ts`; `GraphState` from `server/graph/state.ts`.
- Produces: `writeGenerationPromptNode(state): Promise<Partial<GraphState>>`, `generateImageNode(state): Promise<Partial<GraphState>>` — consumed by `server/graph/build.ts` (Task 15). `generateImageNode` always sets `runStatus: 'paused-final'`, since the very next node is the `reviewFinal` interrupt.

- [ ] **Step 1: Write the failing test for `writeGenerationPromptNode`**

Create `server/graph/nodes/writeGenerationPrompt.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { writeGenerationPromptNode } from './writeGenerationPrompt.js'
import * as promptAgent from '../../agents/writeGenerationPrompt.js'
import { createInitialState } from '../state.js'

vi.mock('../../agents/writeGenerationPrompt.js', () => ({ writeGenerationPrompt: vi.fn() }))
vi.mock('../../env.js', async () => {
  const actual = await vi.importActual<typeof import('../../env.js')>('../../env.js')
  return { ...actual, getCursorApiKey: () => 'test-key' }
})

describe('writeGenerationPromptNode', () => {
  it('passes only approved images and sets generationPrompt from the agent result', async () => {
    vi.mocked(promptAgent.writeGenerationPrompt).mockResolvedValue('a very detailed prompt')
    const state = createInitialState('run-1', 'nasi lemak')
    state.referenceImages = [
      { id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/tmp/a.jpg', status: 'approved' },
      { id: 'b', sourceUrl: 'https://x/b.jpg', localPath: '/tmp/b.jpg', status: 'rejected' },
    ]

    const result = await writeGenerationPromptNode(state)

    expect(result.generationPrompt).toBe('a very detailed prompt')
    const call = vi.mocked(promptAgent.writeGenerationPrompt).mock.calls[0][0]
    expect(call.approvedImages).toHaveLength(1)
    expect(call.approvedImages[0].id).toBe('a')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/graph/nodes/writeGenerationPrompt.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `server/graph/nodes/writeGenerationPrompt.ts`**

```ts
import path from 'node:path'
import { writeGenerationPrompt } from '../../agents/writeGenerationPrompt.js'
import { getCursorApiKey, runDir } from '../../env.js'
import type { GraphState } from '../state.js'

export async function writeGenerationPromptNode(state: GraphState): Promise<Partial<GraphState>> {
  const approvedImages = state.referenceImages.filter((image) => image.status === 'approved')
  const outputPath = path.join(runDir(state.runId), `generation-prompt-${state.finalRound}.txt`)
  const generationPrompt = await writeGenerationPrompt({
    apiKey: getCursorApiKey(),
    prompt: state.prompt,
    approvedImages,
    finalRejectReason: state.finalRejectReason,
    outputPath,
  })
  return { generationPrompt }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/graph/nodes/writeGenerationPrompt.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for `generateImageNode`**

Create `server/graph/nodes/generateImage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { generateImageNode } from './generateImage.js'
import * as generateAgent from '../../agents/generateImage.js'
import { createInitialState } from '../state.js'

vi.mock('../../agents/generateImage.js', () => ({ generateFoodImage: vi.fn() }))
vi.mock('../../env.js', async () => {
  const actual = await vi.importActual<typeof import('../../env.js')>('../../env.js')
  return { ...actual, getCursorApiKey: () => 'test-key' }
})

describe('generateImageNode', () => {
  it('generates from the state generationPrompt and marks paused-final', async () => {
    vi.mocked(generateAgent.generateFoodImage).mockResolvedValue(undefined)
    const state = createInitialState('run-1', 'nasi lemak')
    state.generationPrompt = 'a very detailed prompt'

    const result = await generateImageNode(state)

    expect(result.runStatus).toBe('paused-final')
    expect(result.generatedImagePath).toContain('run-1')
    expect(generateAgent.generateFoodImage).toHaveBeenCalledWith(
      expect.objectContaining({ generationPrompt: 'a very detailed prompt' }),
    )
  })

  it('throws if generationPrompt is missing', async () => {
    const state = createInitialState('run-1', 'nasi lemak')
    await expect(generateImageNode(state)).rejects.toThrow('requires generationPrompt')
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run server/graph/nodes/generateImage.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 7: Write `server/graph/nodes/generateImage.ts`**

```ts
import path from 'node:path'
import { generateFoodImage } from '../../agents/generateImage.js'
import { getCursorApiKey, runDir } from '../../env.js'
import type { GraphState } from '../state.js'

export async function generateImageNode(state: GraphState): Promise<Partial<GraphState>> {
  if (!state.generationPrompt) {
    throw new Error('generateImageNode requires generationPrompt to be set')
  }
  const outputPath = path.join(runDir(state.runId), 'generated', `attempt-${state.finalRound}.png`)
  await generateFoodImage({ apiKey: getCursorApiKey(), generationPrompt: state.generationPrompt, outputPath })
  return { generatedImagePath: outputPath, runStatus: 'paused-final' }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run server/graph/nodes/generateImage.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add server/graph/nodes/writeGenerationPrompt.ts server/graph/nodes/generateImage.ts server/graph/nodes/writeGenerationPrompt.test.ts server/graph/nodes/generateImage.test.ts
git commit -m "Add writeGenerationPrompt and generateImage graph nodes"
```

---

## Task 14: `reviewFinal` interrupt node + router

**Files:**
- Create: `server/graph/nodes/reviewFinal.ts`
- Modify: `server/graph/routers.ts` (add `routeAfterReviewFinal`)
- Test: `server/graph/nodes/reviewFinal.test.ts`

**Interfaces:**
- Consumes: `interrupt` from `@langchain/langgraph`; `applyFinalDecision`, `decideFinalOutcome` from `server/graph/decisions.ts`; `GraphState`; `ResumeFinalPayload`.
- Produces: `reviewFinal(state): Promise<Partial<GraphState>>`, `routeAfterReviewFinal(state): 'writeGenerationPrompt' | 'reviewFinal' | typeof END` — both consumed by `server/graph/build.ts` (Task 15).

- [ ] **Step 1: Write the failing test**

Create `server/graph/nodes/reviewFinal.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { StateGraph, START, END, MemorySaver, Command } from '@langchain/langgraph'
import { RunAnnotation, createInitialState } from '../state.js'
import { reviewFinal } from './reviewFinal.js'

function buildTestGraph() {
  return new StateGraph(RunAnnotation)
    .addNode('reviewFinal', reviewFinal)
    .addEdge(START, 'reviewFinal')
    .addEdge('reviewFinal', END)
    .compile({ checkpointer: new MemorySaver() })
}

describe('reviewFinal', () => {
  it('pauses with the generated image path and resumes to done on approval', async () => {
    const graph = buildTestGraph()
    const config = { configurable: { thread_id: 'f1' } }
    const initial = createInitialState('run-1', 'nasi lemak')
    initial.generatedImagePath = '/tmp/attempt-0.png'

    await graph.invoke(initial, config)
    const paused = await graph.getState(config)
    expect(paused.tasks[0].interrupts[0].value).toMatchObject({ type: 'final', imagePath: '/tmp/attempt-0.png' })

    await graph.invoke(new Command({ resume: { status: 'approved' } }), config)
    const finished = await graph.getState(config)
    expect(finished.values.runStatus).toBe('done')
    expect(finished.values.lastFinalOutcome).toBe('done')
  })

  it('increments finalRound and stays working on a rejection under the cap', async () => {
    const graph = buildTestGraph()
    const config = { configurable: { thread_id: 'f2' } }
    const initial = createInitialState('run-2', 'nasi lemak')
    initial.generatedImagePath = '/tmp/attempt-0.png'

    await graph.invoke(initial, config)
    await graph.invoke(new Command({ resume: { status: 'rejected', rejectReason: 'too glossy' } }), config)
    const finished = await graph.getState(config)
    expect(finished.values.finalRound).toBe(1)
    expect(finished.values.runStatus).toBe('working')
    expect(finished.values.finalRejectReason).toBe('too glossy')
  })

  it('holds capped on the first rejection past the round limit', async () => {
    const graph = buildTestGraph()
    const config = { configurable: { thread_id: 'f3' } }
    const initial = createInitialState('run-3', 'nasi lemak')
    initial.generatedImagePath = '/tmp/attempt-5.png'
    initial.finalRound = 5

    await graph.invoke(initial, config)
    await graph.invoke(new Command({ resume: { status: 'rejected', rejectReason: 'still bad' } }), config)
    const finished = await graph.getState(config)
    expect(finished.values.runStatus).toBe('capped-final')
    expect(finished.values.lastFinalOutcome).toBe('hold-capped')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/graph/nodes/reviewFinal.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `server/graph/nodes/reviewFinal.ts`**

```ts
import { interrupt } from '@langchain/langgraph'
import { applyFinalDecision, decideFinalOutcome } from '../decisions.js'
import type { GraphState } from '../state.js'
import type { ResumeFinalPayload } from '../../../shared/types.js'

type FinalInterruptValue = { type: 'final'; imagePath: string; capped: boolean }

export async function reviewFinal(state: GraphState): Promise<Partial<GraphState>> {
  const payload = interrupt<FinalInterruptValue, ResumeFinalPayload>({
    type: 'final',
    imagePath: state.generatedImagePath ?? '',
    capped: state.runStatus === 'capped-final',
  })

  const { finalStatus, finalRejectReason } = applyFinalDecision(payload)
  const outcome = decideFinalOutcome({ finalStatus, finalRound: state.finalRound, runStatus: state.runStatus })

  if (outcome === 'done') {
    return { finalStatus, finalRejectReason, runStatus: 'done', lastFinalOutcome: outcome }
  }
  if (outcome === 'retry') {
    return {
      finalStatus,
      finalRejectReason,
      finalRound: state.finalRound + 1,
      runStatus: 'working',
      lastFinalOutcome: outcome,
    }
  }
  if (outcome === 'hold-capped') {
    return { finalStatus, finalRejectReason, runStatus: 'capped-final', lastFinalOutcome: outcome }
  }
  return { finalStatus, finalRejectReason, runStatus: 'abandoned', lastFinalOutcome: outcome }
}
```

- [ ] **Step 4: Add `routeAfterReviewFinal` to `server/graph/routers.ts`**

Modify `server/graph/routers.ts` (append):

```ts
export function routeAfterReviewFinal(
  state: GraphState,
): 'writeGenerationPrompt' | 'reviewFinal' | typeof END {
  switch (state.lastFinalOutcome) {
    case 'done':
      return END
    case 'retry':
      return 'writeGenerationPrompt'
    case 'hold-capped':
      return 'reviewFinal'
    case 'abandon':
      return END
    default:
      return 'writeGenerationPrompt'
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run server/graph/nodes/reviewFinal.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/graph/nodes/reviewFinal.ts server/graph/routers.ts server/graph/nodes/reviewFinal.test.ts
git commit -m "Add reviewFinal interrupt node and its router"
```

---

## Task 15: Assemble the StateGraph

**Files:**
- Create: `server/graph/build.ts`
- Test: `server/graph/build.test.ts`

**Interfaces:**
- Consumes: every node from Tasks 10-14, `routeAfterReviewReferences`/`routeAfterReviewFinal` from `server/graph/routers.ts`, `RunAnnotation`/`createInitialState`/`toPublicRunState`/`GraphState` from `server/graph/state.ts`, `toPublicPath` from `server/env.ts`.
- Produces: `startRun(prompt: string): Promise<RunSnapshot>`, `resumeRun(runId: string, payload: ResumeReferencesPayload | ResumeFinalPayload): Promise<RunSnapshot | null>`, `getRunSnapshot(runId: string): Promise<RunSnapshot | null>` — consumed by `server/routes/runs.ts` (Task 16).

This test is the centerpiece of the whole plan: it exercises the complete graph end-to-end (happy path, one reject-loop at each gate, and the failure path) with every I/O boundary (search, download, Cursor agents) mocked, so it runs fast and deterministically without a real `CURSOR_API_KEY`. The round-cap edge cases are already covered exhaustively by Task 3's and Tasks 12/14's tests, so this task does not repeat them.

- [ ] **Step 1: Write the failing tests**

Create `server/graph/build.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as searchIndex from '../search/index.js'
import * as download from '../search/download.js'
import * as screenAgent from '../agents/screenReferences.js'
import * as promptAgent from '../agents/writeGenerationPrompt.js'
import * as generateAgent from '../agents/generateImage.js'

vi.mock('../search/index.js', () => ({ findReferenceCandidates: vi.fn() }))
vi.mock('../search/download.js', () => ({ downloadImage: vi.fn() }))
vi.mock('../agents/screenReferences.js', () => ({ screenReferenceImages: vi.fn() }))
vi.mock('../agents/writeGenerationPrompt.js', () => ({ writeGenerationPrompt: vi.fn() }))
vi.mock('../agents/generateImage.js', () => ({ generateFoodImage: vi.fn() }))
vi.mock('../env.js', async () => {
  const actual = await vi.importActual<typeof import('../env.js')>('../env.js')
  return { ...actual, getCursorApiKey: () => 'test-key' }
})

const { startRun, resumeRun } = await import('./build.js')

describe('the full run graph', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(searchIndex.findReferenceCandidates).mockImplementation(async (_query, _exclude, needed) =>
      Array.from({ length: needed }, (_v, i) => ({ sourceUrl: `https://example.com/${Math.random()}-${i}.jpg` })),
    )
    vi.mocked(download.downloadImage).mockResolvedValue(undefined)
    vi.mocked(screenAgent.screenReferenceImages).mockImplementation(async ({ images }) =>
      Object.fromEntries(images.map((image) => [image.id, 'looks plausible'])),
    )
    vi.mocked(promptAgent.writeGenerationPrompt).mockResolvedValue('a very detailed prompt')
    vi.mocked(generateAgent.generateFoodImage).mockResolvedValue(undefined)
  })

  it('runs the happy path from prompt to a done, approved image', async () => {
    const started = await startRun('nasi lemak with fried chicken')
    expect(started.state.runStatus).toBe('paused-references')
    expect(started.pendingInterrupt?.type).toBe('references')
    const images = started.pendingInterrupt!.type === 'references' ? started.pendingInterrupt.images : []
    expect(images).toHaveLength(5)

    const afterReferences = await resumeRun(started.runId, {
      decisions: images.map((image) => ({ id: image.id, status: 'approved' as const })),
    })
    expect(afterReferences?.state.runStatus).toBe('paused-final')
    expect(afterReferences?.pendingInterrupt?.type).toBe('final')

    const afterFinal = await resumeRun(started.runId, { status: 'approved' })
    expect(afterFinal?.state.runStatus).toBe('done')
    expect(afterFinal?.pendingInterrupt).toBeNull()
  })

  it('loops once on a reference rejection before proceeding', async () => {
    const started = await startRun('nasi lemak with fried chicken')
    const images = started.pendingInterrupt!.type === 'references' ? started.pendingInterrupt.images : []

    const afterReject = await resumeRun(started.runId, {
      decisions: [
        { id: images[0].id, status: 'rejected' as const, rejectReason: 'looks AI-generated' },
        ...images.slice(1).map((image) => ({ id: image.id, status: 'approved' as const })),
      ],
    })
    expect(afterReject?.state.runStatus).toBe('paused-references')
    expect(afterReject?.state.referenceRound).toBe(1)
    const newImages = afterReject?.pendingInterrupt?.type === 'references' ? afterReject.pendingInterrupt.images : []
    expect(newImages).toHaveLength(5)

    const afterApproveAll = await resumeRun(started.runId, {
      decisions: newImages.map((image) => ({ id: image.id, status: 'approved' as const })),
    })
    expect(afterApproveAll?.state.runStatus).toBe('paused-final')
  })

  it('loops once on a final-image rejection before finishing', async () => {
    const started = await startRun('nasi lemak with fried chicken')
    const images = started.pendingInterrupt!.type === 'references' ? started.pendingInterrupt.images : []
    const afterReferences = await resumeRun(started.runId, {
      decisions: images.map((image) => ({ id: image.id, status: 'approved' as const })),
    })
    expect(afterReferences?.state.runStatus).toBe('paused-final')

    const afterReject = await resumeRun(started.runId, { status: 'rejected', rejectReason: 'too glossy' })
    expect(afterReject?.state.runStatus).toBe('paused-final')
    expect(afterReject?.state.finalRound).toBe(1)
    expect(promptAgent.writeGenerationPrompt).toHaveBeenCalledTimes(2)

    const afterApprove = await resumeRun(started.runId, { status: 'approved' })
    expect(afterApprove?.state.runStatus).toBe('done')
  })

  it('marks the run failed when a node throws', async () => {
    vi.mocked(screenAgent.screenReferenceImages).mockRejectedValue(new Error('cursor unavailable'))
    const started = await startRun('nasi lemak with fried chicken')
    expect(started.state.runStatus).toBe('failed')
    expect(started.state.error).toContain('cursor unavailable')
  })

  it('returns null when resuming an unknown run', async () => {
    const result = await resumeRun('does-not-exist', { status: 'approved' })
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/graph/build.test.ts`
Expected: FAIL — `server/graph/build.ts` does not exist.

- [ ] **Step 3: Write `server/graph/build.ts`**

```ts
import { randomUUID } from 'node:crypto'
import { StateGraph, START, END, MemorySaver, Command } from '@langchain/langgraph'
import { RunAnnotation, createInitialState, toPublicRunState, type GraphState } from './state.js'
import { searchReferences } from './nodes/searchReferences.js'
import { screenReferencesNode } from './nodes/screenReferences.js'
import { reviewReferences } from './nodes/reviewReferences.js'
import { writeGenerationPromptNode } from './nodes/writeGenerationPrompt.js'
import { generateImageNode } from './nodes/generateImage.js'
import { reviewFinal } from './nodes/reviewFinal.js'
import { routeAfterReviewFinal, routeAfterReviewReferences } from './routers.js'
import { toPublicPath } from '../env.js'
import type {
  PendingInterrupt,
  ReferenceImage,
  ResumeFinalPayload,
  ResumeReferencesPayload,
  RunSnapshot,
} from '../../shared/types.js'

const checkpointer = new MemorySaver()

const compiledGraph = new StateGraph(RunAnnotation)
  .addNode('searchReferences', searchReferences)
  .addNode('screenReferences', screenReferencesNode)
  .addNode('reviewReferences', reviewReferences)
  .addNode('writeGenerationPrompt', writeGenerationPromptNode)
  .addNode('generateImage', generateImageNode)
  .addNode('reviewFinal', reviewFinal)
  .addEdge(START, 'searchReferences')
  .addEdge('searchReferences', 'screenReferences')
  .addEdge('screenReferences', 'reviewReferences')
  .addConditionalEdges('reviewReferences', routeAfterReviewReferences)
  .addEdge('writeGenerationPrompt', 'generateImage')
  .addEdge('generateImage', 'reviewFinal')
  .addConditionalEdges('reviewFinal', routeAfterReviewFinal)
  .compile({ checkpointer })

type ReferencesInterruptValue = { type: 'references'; images: ReferenceImage[]; capped: boolean }
type FinalInterruptValue = { type: 'final'; imagePath: string; capped: boolean }

function pendingInterruptFrom(tasks: { interrupts: { value: unknown }[] }[]): PendingInterrupt {
  for (const task of tasks) {
    for (const item of task.interrupts) {
      const value = item.value as ReferencesInterruptValue | FinalInterruptValue
      if (value.type === 'references') {
        return {
          type: 'references',
          images: value.images.map((image) => ({ ...image, localPath: toPublicPath(image.localPath) })),
          capped: value.capped,
        }
      }
      return { type: 'final', imageUrl: toPublicPath(value.imagePath), capped: value.capped }
    }
  }
  return null
}

function configFor(runId: string) {
  return { configurable: { thread_id: runId } }
}

async function invokeAndCapture(input: unknown, config: ReturnType<typeof configFor>): Promise<void> {
  try {
    await compiledGraph.invoke(input, config)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await compiledGraph.updateState(config, { runStatus: 'failed', error: message })
  }
}

export async function startRun(prompt: string): Promise<RunSnapshot> {
  const runId = randomUUID()
  const config = configFor(runId)
  await invokeAndCapture(createInitialState(runId, prompt), config)
  const snapshot = await getRunSnapshot(runId)
  if (!snapshot) throw new Error(`Run ${runId} disappeared immediately after starting`)
  return snapshot
}

export async function resumeRun(
  runId: string,
  payload: ResumeReferencesPayload | ResumeFinalPayload,
): Promise<RunSnapshot | null> {
  const config = configFor(runId)
  const existing = await compiledGraph.getState(config)
  if (!existing.values || Object.keys(existing.values).length === 0) return null
  await invokeAndCapture(new Command({ resume: payload }), config)
  return getRunSnapshot(runId)
}

export async function getRunSnapshot(runId: string): Promise<RunSnapshot | null> {
  const config = configFor(runId)
  const snapshot = await compiledGraph.getState(config)
  if (!snapshot.values || Object.keys(snapshot.values).length === 0) return null
  const state = snapshot.values as GraphState
  return {
    runId,
    state: toPublicRunState(state),
    pendingInterrupt: pendingInterruptFrom(snapshot.tasks),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/graph/build.test.ts`
Expected: PASS (5 cases). If a test hangs or times out, the most likely cause is a node awaiting a real network/API call because a mock target path doesn't match the module specifier used inside `build.ts`'s dependency chain — double check every `vi.mock` path above matches the exact relative import used by the corresponding node file.

- [ ] **Step 5: Commit**

```bash
git add server/graph/build.ts server/graph/build.test.ts
git commit -m "Assemble the full run StateGraph with start/resume/snapshot API"
```

---

## Task 16: Express routes

**Files:**
- Create: `server/routes/runs.ts`
- Modify: `server/index.ts` (mount the router and static file serving)
- Test: `server/routes/runs.test.ts`

**Interfaces:**
- Consumes: `startRun`, `resumeRun`, `getRunSnapshot` from `server/graph/build.ts` (Task 15); `RUNS_ROOT` from `server/env.ts`.
- Produces: `runsRouter` (Express `Router`) — mounted at `/api/runs` in `server/index.ts`.

- [ ] **Step 1: Write the failing tests**

Create `server/routes/runs.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { runsRouter } from './runs.js'
import * as build from '../graph/build.js'

vi.mock('../graph/build.js', () => ({
  startRun: vi.fn(),
  resumeRun: vi.fn(),
  getRunSnapshot: vi.fn(),
}))

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/runs', runsRouter)
  return app
}

describe('runsRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST / creates a run and returns its id', async () => {
    vi.mocked(build.startRun).mockResolvedValue({ runId: 'run-1', state: {} as never, pendingInterrupt: null })

    const response = await request(makeApp()).post('/api/runs').send({ prompt: 'nasi lemak' })

    expect(response.status).toBe(201)
    expect(response.body).toEqual({ runId: 'run-1' })
    expect(build.startRun).toHaveBeenCalledWith('nasi lemak')
  })

  it('POST / rejects an empty prompt', async () => {
    const response = await request(makeApp()).post('/api/runs').send({ prompt: '  ' })
    expect(response.status).toBe(400)
    expect(build.startRun).not.toHaveBeenCalled()
  })

  it('GET /:id returns 404 for an unknown run', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue(null)
    const response = await request(makeApp()).get('/api/runs/unknown')
    expect(response.status).toBe(404)
  })

  it('GET /:id returns the snapshot for a known run', async () => {
    vi.mocked(build.getRunSnapshot).mockResolvedValue({ runId: 'run-1', state: {} as never, pendingInterrupt: null })
    const response = await request(makeApp()).get('/api/runs/run-1')
    expect(response.status).toBe(200)
    expect(response.body.runId).toBe('run-1')
  })

  it('POST /:id/resume forwards the payload and returns the updated snapshot', async () => {
    vi.mocked(build.resumeRun).mockResolvedValue({ runId: 'run-1', state: {} as never, pendingInterrupt: null })

    const response = await request(makeApp())
      .post('/api/runs/run-1/resume')
      .send({ decisions: [{ id: 'a', status: 'approved' }] })

    expect(response.status).toBe(200)
    expect(build.resumeRun).toHaveBeenCalledWith('run-1', { decisions: [{ id: 'a', status: 'approved' }] })
  })

  it('POST /:id/resume returns 404 for an unknown run', async () => {
    vi.mocked(build.resumeRun).mockResolvedValue(null)
    const response = await request(makeApp()).post('/api/runs/unknown/resume').send({ status: 'approved' })
    expect(response.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/routes/runs.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `server/routes/runs.ts`**

```ts
import { Router } from 'express'
import { getRunSnapshot, resumeRun, startRun } from '../graph/build.js'
import type { ResumeFinalPayload, ResumeReferencesPayload } from '../../shared/types.js'

export const runsRouter = Router()

runsRouter.post('/', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' })
    return
  }
  const snapshot = await startRun(prompt)
  res.status(201).json({ runId: snapshot.runId })
})

runsRouter.get('/:id', async (req, res) => {
  const snapshot = await getRunSnapshot(req.params.id)
  if (!snapshot) {
    res.status(404).json({ error: 'run not found' })
    return
  }
  res.json(snapshot)
})

runsRouter.post('/:id/resume', async (req, res) => {
  const payload = req.body as ResumeReferencesPayload | ResumeFinalPayload
  const snapshot = await resumeRun(req.params.id, payload)
  if (!snapshot) {
    res.status(404).json({ error: 'run not found' })
    return
  }
  res.json(snapshot)
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/routes/runs.test.ts`
Expected: PASS

- [ ] **Step 5: Wire the router and static file serving into `server/index.ts`**

Modify `server/index.ts`:

```ts
import 'dotenv/config'
import express from 'express'
import { PORT, RUNS_ROOT } from './env.js'
import { runsRouter } from './routes/runs.js'

export const app = express()
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/runs', runsRouter)
app.use('/runs', express.static(RUNS_ROOT))

const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
  })
}
```

- [ ] **Step 6: Run the full server test suite to make sure nothing regressed**

Run: `npx vitest run server`
Expected: PASS across all server test files.

- [ ] **Step 7: Commit**

```bash
git add server/routes/runs.ts server/routes/runs.test.ts server/index.ts
git commit -m "Add Express routes for creating, reading, and resuming runs"
```

---

## Task 17: Frontend scaffolding — API client, routing, Home page

**Files:**
- Create: `src/api.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/pages/Home.tsx`
- Create: `src/styles.css`
- Test: `src/pages/Home.test.tsx`

**Interfaces:**
- Consumes: `ResumeFinalPayload`, `ResumeReferencesPayload`, `RunSnapshot` from `shared/types.ts` (Task 2).
- Produces: `createRun(prompt: string): Promise<{ runId: string }>`, `fetchRun(runId: string): Promise<RunSnapshot>`, `resumeRun(runId: string, payload): Promise<RunSnapshot>` from `src/api.ts` — consumed by `src/pages/Home.tsx` and `src/pages/RunPage.tsx` (Task 18).

- [ ] **Step 1: Write `src/api.ts`**

```ts
import type { ResumeFinalPayload, ResumeReferencesPayload, RunSnapshot } from '../shared/types.js'

const BASE = '/api/runs'

export async function createRun(prompt: string): Promise<{ runId: string }> {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  if (!response.ok) throw new Error(`Failed to create run: ${response.status}`)
  return response.json()
}

export async function fetchRun(runId: string): Promise<RunSnapshot> {
  const response = await fetch(`${BASE}/${runId}`)
  if (!response.ok) throw new Error(`Failed to fetch run: ${response.status}`)
  return response.json()
}

export async function resumeRun(
  runId: string,
  payload: ResumeReferencesPayload | ResumeFinalPayload,
): Promise<RunSnapshot> {
  const response = await fetch(`${BASE}/${runId}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`Failed to resume run: ${response.status}`)
  return response.json()
}
```

- [ ] **Step 2: Write `src/styles.css`**

```css
body {
  font-family: system-ui, sans-serif;
  max-width: 720px;
  margin: 2rem auto;
  padding: 0 1rem;
  color: #1a1a1a;
}

textarea, input {
  font: inherit;
  width: 100%;
  padding: 0.5rem;
  box-sizing: border-box;
}

button {
  font: inherit;
  padding: 0.5rem 1rem;
  margin: 0.25rem 0.25rem 0.25rem 0;
}

ul {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

[role="alert"] {
  color: #a40000;
  font-weight: 600;
}
```

- [ ] **Step 3: Write `src/App.tsx`**

```tsx
import { Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home.js'
import { RunPage } from './pages/RunPage.js'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/runs/:runId" element={<RunPage />} />
    </Routes>
  )
}
```

Note: `RunPage` is created in Task 18. `App.tsx` will not type-check until then — that's expected, this task focuses on `Home`.

- [ ] **Step 4: Write `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App.js'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 5: Write the failing test for `Home`**

Create `src/pages/Home.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Home } from './Home.js'
import * as api from '../api.js'

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/runs/:runId" element={<div>Run page for run-123</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Home', () => {
  it('creates a run and navigates to it on submit', async () => {
    vi.spyOn(api, 'createRun').mockResolvedValue({ runId: 'run-123' })
    const user = userEvent.setup()

    renderHome()
    await user.type(screen.getByLabelText('Describe a dish'), 'nasi lemak with fried chicken')
    await user.click(screen.getByRole('button', { name: /generate/i }))

    expect(api.createRun).toHaveBeenCalledWith('nasi lemak with fried chicken')
    expect(await screen.findByText('Run page for run-123')).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    vi.spyOn(api, 'createRun').mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()

    renderHome()
    await user.type(screen.getByLabelText('Describe a dish'), 'nasi lemak')
    await user.click(screen.getByRole('button', { name: /generate/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('network down')
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/pages/Home.test.tsx`
Expected: FAIL — `src/pages/Home.tsx` does not exist.

- [ ] **Step 7: Write `src/pages/Home.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRun } from '../api.js'

export function Home() {
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!prompt.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { runId } = await createRun(prompt.trim())
      navigate(`/runs/${runId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start run')
      setSubmitting(false)
    }
  }

  return (
    <main>
      <h1>Food photo, without the AI slop</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="prompt">Describe a dish</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="nasi lemak with fried chicken"
          rows={3}
        />
        <button type="submit" disabled={submitting || !prompt.trim()}>
          {submitting ? 'Starting…' : 'Generate'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/pages/Home.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/api.ts src/styles.css src/App.tsx src/main.tsx src/pages/Home.tsx src/pages/Home.test.tsx
git commit -m "Add frontend scaffolding, API client, and Home page"
```

---

## Task 18: RunPage, ReferenceGrid, and FinalReview

**Files:**
- Create: `src/components/ReferenceGrid.tsx`
- Create: `src/components/FinalReview.tsx`
- Create: `src/pages/RunPage.tsx`
- Test: `src/components/ReferenceGrid.test.tsx`
- Test: `src/components/FinalReview.test.tsx`
- Test: `src/pages/RunPage.test.tsx`

**Interfaces:**
- Consumes: `fetchRun`, `resumeRun` from `src/api.ts` (Task 17); `RunSnapshot`, `ReferenceImage` from `shared/types.ts`.
- Produces: `ReferenceGrid`, `FinalReview`, `RunPage` React components. `App.tsx` (Task 17) now fully type-checks.

- [ ] **Step 1: Write the failing test for `ReferenceGrid`**

Create `src/components/ReferenceGrid.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReferenceGrid } from './ReferenceGrid.js'
import type { ReferenceImage } from '../../shared/types.js'

const images: ReferenceImage[] = [
  { id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/runs/1/references/a.jpg', status: 'pending', cursorNote: 'looks real' },
  { id: 'b', sourceUrl: 'https://x/b.jpg', localPath: '/runs/1/references/b.jpg', status: 'pending' },
]

describe('ReferenceGrid', () => {
  it('submits a decision per image, defaulting undecided ones to rejected', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<ReferenceGrid images={images} capped={false} round={0} onSubmit={onSubmit} />)

    const approveButtons = screen.getAllByRole('button', { name: 'Approve' })
    await user.click(approveButtons[0])
    await user.click(screen.getAllByRole('button', { name: 'Reject' })[1])
    await user.click(screen.getByRole('button', { name: 'Submit review' }))

    expect(onSubmit).toHaveBeenCalledWith([
      { id: 'a', status: 'approved', rejectReason: undefined },
      { id: 'b', status: 'rejected', rejectReason: undefined },
    ])
  })

  it('shows a capped banner explaining that rejecting will abandon the run', () => {
    render(<ReferenceGrid images={images} capped round={5} onSubmit={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('5 times')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ReferenceGrid.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `src/components/ReferenceGrid.tsx`**

```tsx
import { useState } from 'react'
import type { ReferenceImage } from '../../shared/types.js'

type Decision = { status: 'approved' | 'rejected'; rejectReason?: string }

export function ReferenceGrid(props: {
  images: ReferenceImage[]
  capped: boolean
  round: number
  onSubmit: (decisions: { id: string; status: 'approved' | 'rejected'; rejectReason?: string }[]) => void
}) {
  const { images, capped, round, onSubmit } = props
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})

  function setStatus(id: string, status: 'approved' | 'rejected') {
    setDecisions((prev) => ({ ...prev, [id]: { status, rejectReason: prev[id]?.rejectReason } }))
  }

  function setReason(id: string, rejectReason: string) {
    setDecisions((prev) => ({ ...prev, [id]: { status: 'rejected', rejectReason } }))
  }

  function handleSubmit() {
    onSubmit(
      images.map((image) => ({
        id: image.id,
        status: decisions[image.id]?.status ?? 'rejected',
        rejectReason: decisions[image.id]?.rejectReason,
      })),
    )
  }

  return (
    <section>
      <h1>Review reference photos</h1>
      {capped && (
        <p role="alert">
          This has looped {round} times. You can still approve one of these to continue, but rejecting now
          will abandon the run.
        </p>
      )}
      <ul>
        {images.map((image) => (
          <li key={image.id}>
            <img src={image.localPath} alt="Candidate reference" />
            {image.cursorNote && <p>{image.cursorNote}</p>}
            <button type="button" onClick={() => setStatus(image.id, 'approved')}>
              Approve
            </button>
            <button type="button" onClick={() => setStatus(image.id, 'rejected')}>
              Reject
            </button>
            {decisions[image.id]?.status === 'rejected' && (
              <input
                aria-label={`Reason for rejecting ${image.id}`}
                value={decisions[image.id]?.rejectReason ?? ''}
                onChange={(event) => setReason(image.id, event.target.value)}
              />
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={handleSubmit}>
        Submit review
      </button>
    </section>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/ReferenceGrid.test.tsx`
Expected: PASS

- [ ] **Step 5: Write the failing test for `FinalReview`**

Create `src/components/FinalReview.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FinalReview } from './FinalReview.js'

describe('FinalReview', () => {
  it('submits approval directly', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<FinalReview imageUrl="/runs/1/generated/attempt-0.png" capped={false} round={0} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Approve' }))

    expect(onSubmit).toHaveBeenCalledWith({ status: 'approved' })
  })

  it('reveals a reason field then submits rejection with it', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<FinalReview imageUrl="/runs/1/generated/attempt-0.png" capped={false} round={0} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await user.type(screen.getByLabelText("Why doesn't this work?"), 'too glossy')
    await user.click(screen.getByRole('button', { name: 'Confirm reject' }))

    expect(onSubmit).toHaveBeenCalledWith({ status: 'rejected', rejectReason: 'too glossy' })
  })

  it('shows a capped banner', () => {
    render(<FinalReview imageUrl="/x.png" capped round={5} onSubmit={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('5 times')
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/components/FinalReview.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 7: Write `src/components/FinalReview.tsx`**

```tsx
import { useState } from 'react'

export function FinalReview(props: {
  imageUrl: string
  capped: boolean
  round: number
  onSubmit: (payload: { status: 'approved' | 'rejected'; rejectReason?: string }) => void
}) {
  const { imageUrl, capped, round, onSubmit } = props
  const [rejectReason, setRejectReason] = useState('')
  const [showReasonField, setShowReasonField] = useState(false)

  return (
    <section>
      <h1>Review the generated photo</h1>
      {capped && (
        <p role="alert">
          This has looped {round} times. You can still approve this image, but rejecting now will abandon the
          run.
        </p>
      )}
      <img src={imageUrl} alt="Generated food photo" />
      <button type="button" onClick={() => onSubmit({ status: 'approved' })}>
        Approve
      </button>
      {!showReasonField ? (
        <button type="button" onClick={() => setShowReasonField(true)}>
          Reject
        </button>
      ) : (
        <>
          <label htmlFor="reject-reason">Why doesn&apos;t this work?</label>
          <input
            id="reject-reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
          />
          <button
            type="button"
            onClick={() => onSubmit({ status: 'rejected', rejectReason: rejectReason.trim() || undefined })}
          >
            Confirm reject
          </button>
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/components/FinalReview.test.tsx`
Expected: PASS

- [ ] **Step 9: Write the failing test for `RunPage`**

Create `src/pages/RunPage.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RunPage } from './RunPage.js'
import * as api from '../api.js'
import type { RunSnapshot } from '../../shared/types.js'

function renderRunPage() {
  return render(
    <MemoryRouter initialEntries={['/runs/run-1']}>
      <Routes>
        <Route path="/runs/:runId" element={<RunPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function baseState(overrides: Partial<RunSnapshot['state']> = {}): RunSnapshot['state'] {
  return {
    prompt: 'nasi lemak',
    referenceImages: [],
    excludedSourceUrls: [],
    referenceRound: 0,
    finalStatus: 'pending',
    finalRound: 0,
    runStatus: 'working',
    ...overrides,
  }
}

describe('RunPage', () => {
  it('shows a working message while the graph is processing', async () => {
    vi.spyOn(api, 'fetchRun').mockResolvedValue({ runId: 'run-1', state: baseState(), pendingInterrupt: null })
    renderRunPage()
    expect(await screen.findByText('Working…')).toBeInTheDocument()
  })

  it('renders the reference review UI and resumes on submit', async () => {
    const snapshot: RunSnapshot = {
      runId: 'run-1',
      state: baseState({ runStatus: 'paused-references' }),
      pendingInterrupt: {
        type: 'references',
        capped: false,
        images: [{ id: 'a', sourceUrl: 'https://x/a.jpg', localPath: '/runs/1/a.jpg', status: 'pending' }],
      },
    }
    vi.spyOn(api, 'fetchRun').mockResolvedValue(snapshot)
    vi.spyOn(api, 'resumeRun').mockResolvedValue({ ...snapshot, state: baseState({ runStatus: 'paused-final' }) })
    const user = userEvent.setup()

    renderRunPage()
    await screen.findByText('Review reference photos')
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await user.click(screen.getByRole('button', { name: 'Submit review' }))

    expect(api.resumeRun).toHaveBeenCalledWith('run-1', { decisions: [{ id: 'a', status: 'approved', rejectReason: undefined }] })
  })

  it('renders the done state with the final image', async () => {
    vi.spyOn(api, 'fetchRun').mockResolvedValue({
      runId: 'run-1',
      state: baseState({ runStatus: 'done', generatedImagePath: '/runs/1/generated/attempt-0.png' }),
      pendingInterrupt: null,
    })
    renderRunPage()
    expect(await screen.findByRole('img', { name: 'Final food photo' })).toHaveAttribute(
      'src',
      '/runs/1/generated/attempt-0.png',
    )
  })

  it('renders a failed state with the error message', async () => {
    vi.spyOn(api, 'fetchRun').mockResolvedValue({
      runId: 'run-1',
      state: baseState({ runStatus: 'failed', error: 'cursor unavailable' }),
      pendingInterrupt: null,
    })
    renderRunPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('cursor unavailable')
  })
})
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `npx vitest run src/pages/RunPage.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 11: Write `src/pages/RunPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchRun, resumeRun } from '../api.js'
import { ReferenceGrid } from '../components/ReferenceGrid.js'
import { FinalReview } from '../components/FinalReview.js'
import type { RunSnapshot } from '../../shared/types.js'

const POLL_INTERVAL_MS = 2000

export function RunPage() {
  const { runId } = useParams<{ runId: string }>()
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!runId) return
    try {
      const next = await fetchRun(runId)
      setSnapshot(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run')
    }
  }, [runId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!snapshot || snapshot.state.runStatus !== 'working') return
    const timer = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [snapshot, refresh])

  async function handleReferencesSubmit(
    decisions: { id: string; status: 'approved' | 'rejected'; rejectReason?: string }[],
  ) {
    if (!runId) return
    setSnapshot(await resumeRun(runId, { decisions }))
  }

  async function handleFinalSubmit(payload: { status: 'approved' | 'rejected'; rejectReason?: string }) {
    if (!runId) return
    setSnapshot(await resumeRun(runId, payload))
  }

  if (error) return <p role="alert">{error}</p>
  if (!snapshot) return <p>Loading…</p>

  const { state, pendingInterrupt } = snapshot

  switch (state.runStatus) {
    case 'working':
      return <p>Working…</p>
    case 'paused-references':
    case 'capped-references':
      return pendingInterrupt?.type === 'references' ? (
        <ReferenceGrid
          images={pendingInterrupt.images}
          capped={pendingInterrupt.capped}
          round={state.referenceRound}
          onSubmit={handleReferencesSubmit}
        />
      ) : null
    case 'paused-final':
    case 'capped-final':
      return pendingInterrupt?.type === 'final' ? (
        <FinalReview
          imageUrl={pendingInterrupt.imageUrl}
          capped={pendingInterrupt.capped}
          round={state.finalRound}
          onSubmit={handleFinalSubmit}
        />
      ) : null
    case 'done':
      return (
        <section>
          <h1>Done</h1>
          {state.generatedImagePath && <img src={state.generatedImagePath} alt="Final food photo" />}
        </section>
      )
    case 'failed':
      return <p role="alert">Run failed: {state.error}</p>
    case 'abandoned':
      return <p role="alert">This run was abandoned.</p>
    default:
      return null
  }
}
```

- [ ] **Step 12: Run the test to verify it passes**

Run: `npx vitest run src/pages/RunPage.test.tsx`
Expected: PASS

- [ ] **Step 13: Type-check and run the full test suite**

Run: `npm run typecheck && npm test`
Expected: no type errors, all tests pass (this is the first point where `App.tsx`'s import of `RunPage` type-checks).

- [ ] **Step 14: Commit**

```bash
git add src/components/ReferenceGrid.tsx src/components/FinalReview.tsx src/pages/RunPage.tsx src/components/ReferenceGrid.test.tsx src/components/FinalReview.test.tsx src/pages/RunPage.test.tsx
git commit -m "Add RunPage with reference and final review UIs"
```

---

## Task 19: Manual end-to-end QA

**Files:** none (no code changes — this is a verification pass using a real `CURSOR_API_KEY`).

**Interfaces:** N/A.

This exercises the one thing the automated suite deliberately cannot: real Cursor Agent calls (screening, prompt-writing, `GenerateImage`) and real Openverse/Wikimedia results.

- [ ] **Step 1: Configure a real API key**

Run: `cp .env.example .env`, then edit `.env` and set `CURSOR_API_KEY` to a real key.

- [ ] **Step 2: Start both dev servers**

Run: `npm run dev`
Expected: both the Express server (port 8787) and Vite (port 5173) start without errors.

- [ ] **Step 3: Submit a prompt**

Open `http://localhost:5173`, enter `nasi lemak with fried chicken`, click Generate.
Expected: navigates to `/runs/<id>` and shows "Working…", then within roughly a minute shows the reference-photo review grid with real downloaded photos and a Cursor note under each.

- [ ] **Step 4: Exercise a reject-and-loop on the reference gate**

Reject one candidate with a reason, approve the rest, click Submit review.
Expected: page returns to "Working…" briefly, then shows a new review grid where the previously-approved images are still present and one new candidate has replaced the rejected one.

- [ ] **Step 5: Approve all references**

Approve every remaining candidate and submit.
Expected: page shows "Working…" while the prompt is written and the image is generated, then shows the final-image review UI with a real generated photo.

- [ ] **Step 6: Exercise a reject-and-loop on the final gate**

Click Reject, type a reason (e.g. "too glossy, doesn't look real"), click Confirm reject.
Expected: page returns to "Working…", then shows a new generated image for review.

- [ ] **Step 7: Approve the final image**

Click Approve.
Expected: page shows the "Done" state with the final image displayed full-size, loaded from `/runs/<id>/generated/...`.

- [ ] **Step 8: Confirm files landed on disk**

Run: `ls runs/<id>/references runs/<id>/generated`
Expected: downloaded reference photos, `notes.json`, one or more `generation-prompt-*.txt` files, and one or more `attempt-*.png` files, matching the number of rounds exercised above.

- [ ] **Step 9: Stop the dev servers**

Press Ctrl+C in the terminal running `npm run dev`.
