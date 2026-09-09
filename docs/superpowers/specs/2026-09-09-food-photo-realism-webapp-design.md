# Food photo realism webapp — design

## Purpose

A webapp that takes a text prompt describing a dish (e.g. "nasi lemak with
fried chicken") and produces a single photorealistic food photo, avoiding the
common tells of AI-generated ("slop") images — waxy textures, perfect
symmetry, fake bokeh, nonsense garnish, oversaturated color grading, etc.

The pipeline grounds the final generation prompt in real reference photos
(found on the web, human-vetted) rather than generating from the text prompt
alone, and puts a human in the loop at two points: approving the reference
photos used for grounding, and approving the final generated image.

## Non-goals

- No recipe text, steps, or page generation — image only.
- No user accounts, auth, or multi-tenant storage.
- No production-grade persistence — this is a self-learning project run
  locally.

## Anti-slop prompt guidance

This is the core knowledge the `writeGenerationPrompt` agent's system prompt
must encode. Core principle: if a human food photographer would not take the
shot this way, don't generate it this way. Real food photography has
physical logic, imperfection, and a specific cooking/plating stage; AI slop
ignores all three.

**Prompt scaffold** — build the generation prompt from these parts, in
order:
1. **Stage-specific description of the dish** (finished plated state, exact
   garnish/components) — not a generic "delicious food" description.
2. **Material/texture cues** — e.g. piece sizes vary 15–30%, matte patches
   next to glossy ones, sauce pooling thicker in some spots with a thin oil
   sheen, not uniform gloss.
3. **Light direction** — one consistent, physically plausible source (e.g.
   soft natural light from the left, a slight hot spot, asymmetric shadow
   falloff).
4. **Camera style** — e.g. 50mm lens, shallow but slightly uneven depth-of-
   field falloff, a touch of sensor grain, faint chromatic aberration at
   high-contrast edges.
5. **Explicit negatives** — no identical pieces/dice, no radial or
   symmetrical plating, no algorithmic garnish scatter, no thick centered
   steam plume, no tiled/repeating background texture, no plastic texture,
   no oversaturation, no floating ingredients, no readable label text or
   logos.

**Hard avoid list** (feed into both the prompt-writer and the reference
screening step as things to flag):
- Waxy, glossy, airbrushed food; plastic or rubbery textures; perfectly
  uniform browning or mincing.
- Oversaturated/neon colors; a single AI color-grade skew (heavy teal-orange,
  all-amber, magenta-cyan).
- Steam or liquids defying physics (symmetrical plumes, drips that don't
  pool, sauce frozen mid-air); duplicated or floating garnish.
- Malformed hands/utensils; wrong proportions (pan vs. stove, portion vs.
  plate).
- Radial/symmetrical plating; studio-perfect crumbs or garnish rings;
  repeating/tiled background patterns.
- Readable text, logos, or watermarks on packaging or dishware.
- Product-shot-perfect uniform lighting with no natural asymmetry.

**Appetite checklist** — before accepting a generation prompt or a generated
image, it should pass: food looks edible (not a render); textures are
visually distinguishable; colors are warm/natural and match real ingredient
colors; composition draws the eye to the food; no artifacts (melted
utensils, extra limbs, garbled text, impossible physics); natural
irregularity is visible (varied piece sizes, hand-scattered garnish, uneven
sauce pooling, non-perfect lighting).

**Few-shot slop examples** — `server/prompts/ai-slop-examples/` holds a
small curated set of real AI-slop food photos (provided by the project
owner) plus `annotations.md`, which explains for each image specifically why
it's slop, tied back to a category above (texture, color, physics, staging,
etc.). Both `screenReferences` and `writeGenerationPrompt` are instructed to
read these images and annotations as calibration counter-examples before
doing their judgment/writing — this is few-shot visual grounding for
judgment, not an exact-match blocklist against these specific files.

## Stack

- **Frontend**: Vite + React + TypeScript.
- **Backend**: Node + Express (or Fastify) API server, separate process from
  the Vite dev server (Vite proxies `/api` to it in dev).
- **Orchestration**: LangGraph.js `StateGraph`, using its `interrupt()` /
  `Command({ resume })` mechanism for the two human-review gates.
- **Checkpointer**: LangGraph `MemorySaver` (in-memory). A server restart
  during a paused review loses that run's progress — acceptable for a
  solo/local project. Revisit (e.g. SQLite saver) if that becomes annoying.
- **Image generation & vision reasoning**: `@cursor/sdk` `Agent` (model
  `composer-2.5`), using its built-in `generateImage` tool for pixel
  generation and local file reads for vision tasks (screening reference
  photos, writing the generation prompt). Requires `CURSOR_API_KEY`.
- **Reference image search**: Openverse API and/or Wikimedia Commons API —
  both free, keyless, return direct image URLs. Not using Cursor's built-in
  `webSearch` tool: it's a general-purpose tool, not a dedicated
  image-search endpoint, and its reliability for surfacing direct image URLs
  is unverified.

## Repo structure

```
langgraph-ai-image-generator/
├── server/
│   ├── graph/            # StateGraph definition, state schema, conditional edges
│   ├── agents/            # Cursor SDK Agent wrappers: screenReferences, writeGenerationPrompt, generateImage
│   ├── prompts/           # System prompts for each Cursor agent (anti-slop guidance above)
│   │   └── ai-slop-examples/  # 5 example slop photos + annotations.md explaining why each is slop
│   ├── search/            # Openverse/Wikimedia client
│   └── index.ts           # Express app, routes, MemorySaver-backed graph runner
├── src/                   # Vite + React frontend
│   ├── pages/Home.tsx      # Prompt form
│   └── pages/RunPage.tsx   # Polling run view + review UIs
├── runs/{runId}/
│   ├── references/         # Downloaded candidate photos
│   └── generated/          # Cursor-generated images
└── .env                    # CURSOR_API_KEY
```

## State schema

```ts
type ReferenceImage = {
  id: string
  sourceUrl: string
  localPath: string
  cursorNote?: string           // Cursor agent's authenticity/relevance note
  status: 'pending' | 'approved' | 'rejected'
  rejectReason?: string
}

type RunState = {
  prompt: string
  referenceImages: ReferenceImage[]
  excludedSourceUrls: string[]   // rejected sourceUrls, so re-search skips them
  referenceRound: number         // increments each time searchReferences runs after a rejection
  generationPrompt?: string
  generatedImagePath?: string
  finalStatus: 'pending' | 'approved' | 'rejected'
  finalRejectReason?: string
  finalRound: number             // increments each regeneration after a final rejection
  runStatus: 'working' | 'paused-references' | 'paused-final' | 'capped-references' | 'capped-final' | 'done' | 'abandoned' | 'failed'
  error?: string
}
```

## Graph: nodes and edges

1. **`searchReferences`** (plain TS, no agent) — queries Openverse/Wikimedia
   with `prompt`, excluding `excludedSourceUrls`. Downloads enough new
   candidates to bring the unresolved (`pending`) count up to 5, saving them
   under `runs/{id}/references/`.
2. **`screenReferences`** (Cursor SDK Agent, vision, local files, no
   generation tools) — first reads the few-shot slop examples
   (`ai-slop-examples/`) for calibration, then opens each newly downloaded
   candidate and writes a one-line `cursorNote`: does it look like a real
   photo vs. likely AI-generated, and is it relevant to `prompt`, using the
   hard-avoid-list cues above. Advisory only — does not set `status`.
3. **`interrupt: reviewReferences`** — pauses the graph (`runStatus:
   'paused-references'`). Frontend shows all `referenceImages` (thumbnail +
   `cursorNote`) for the human to set `status`/`rejectReason` per image.
   Resume payload: `{ decisions: [{ id, status, rejectReason? }] }`.
4. **Conditional edge** — if any image is `rejected` or still `pending`:
   - If `referenceRound < 5`: move rejected images' `sourceUrl`s into
     `excludedSourceUrls`, increment `referenceRound`, loop back to
     `searchReferences`.
   - If `referenceRound >= 5`: set `runStatus: 'capped-references'` and stay
     at the same interrupt — the human can still approve any existing
     candidate to proceed, but a further reject now sets `runStatus:
     'abandoned'` (terminal) instead of looping.
   - If all `approved`: proceed to `writeGenerationPrompt`.
5. **`writeGenerationPrompt`** (Cursor SDK Agent, vision) — reads the
   few-shot slop examples (`ai-slop-examples/`), all `approved` reference
   images, `prompt`, and (on a retry) `finalRejectReason`. Writes
   `generationPrompt`, applying the anti-slop prompt scaffold above, grounded
   in what it observed in the approved reference photos rather than invented
   from the text prompt alone.
6. **`generateImage`** (Cursor SDK Agent, `generateImage` tool) — generates
   from `generationPrompt`, saves to `runs/{id}/generated/`, sets
   `generatedImagePath`.
7. **`interrupt: reviewFinal`** — pauses the graph (`runStatus:
   'paused-final'`). Frontend shows the generated image. Resume payload:
   `{ status: 'approved' | 'rejected', rejectReason? }`.
8. **Conditional edge**:
   - `rejected` and `finalRound < 5`: increment `finalRound`, loop back to
     `writeGenerationPrompt` carrying `finalRejectReason`.
   - `rejected` and `finalRound >= 5`: set `runStatus: 'capped-final'`; a
     further reject sets `runStatus: 'abandoned'` (terminal); approve still
     works.
   - `approved`: set `runStatus: 'done'` → `END`.

Both round caps are independent and count only rounds triggered by a
rejection (not the first attempt).

## API contract

- `POST /api/runs` `{ prompt: string }` → `{ runId: string }`. Starts the
  graph asynchronously; does not block for the first interrupt.
- `GET /api/runs/:id` → full `RunState` plus which interrupt (if any) is
  currently pending.
- `POST /api/runs/:id/resume` → body shape depends on the pending interrupt
  (reference decisions array, or final approve/reject); resumes the graph via
  `Command({ resume: payload })`; returns the updated `RunState`.
- Static file serving for `runs/{id}/references/*` and `runs/{id}/generated/*`.

## Frontend

- **Home** (`/`) — prompt textarea, submit → `POST /api/runs` → navigate to
  `/runs/:id`.
- **Run page** (`/runs/:id`) — polls `GET /api/runs/:id` every ~2s while
  `runStatus` is `working`. Renders per `runStatus`:
  - `working`: stage label ("Searching for reference photos…", "Writing
    generation prompt…", "Generating image…").
  - `paused-references` / `capped-references`: grid of candidates with
    `cursorNote`, per-image approve/reject (+ reason on reject), submit-all
    button. When capped, a banner explains reject now abandons the run.
  - `paused-final` / `capped-final`: generated image, approve/reject (+
    reason) buttons. Same capped-banner treatment.
  - `done`: final approved image, full-size.
  - `abandoned` / `failed`: terminal state message (+ `error` if failed); no
    further action except starting a new prompt from Home.

## Error handling

- Any node throwing (Cursor agent failure, missing `CURSOR_API_KEY`,
  Openverse/Wikimedia request failure) sets `runStatus: 'failed'` with
  `error` populated. No automatic retry; the human resubmits a new prompt.
- Fewer than 5 candidates found is not an error — proceed with however many
  were found; the human can approve fewer than 5.
- Cursor Agent calls run under a bounded polling timeout when waiting for
  expected output files (e.g. poll for the generated PNG for a few seconds,
  then fail) so a hung agent surfaces as a failed run rather than wedging
  indefinitely.

## Testing

- Unit tests, no external calls: Openverse/Wikimedia query building and
  response parsing; state-reducer and conditional-edge logic (round
  counting, cap transitions, approve/reject aggregation).
- Cursor Agent wrapper functions get mocked-SDK unit tests for surrounding
  orchestration logic, plus thin integration tests gated on `CURSOR_API_KEY`
  being present (skipped otherwise).
- Manual end-to-end pass through the built UI: submit a real prompt, go
  through both review gates (including one reject-and-loop at each gate),
  confirm a final image is produced.

## Open risks

- Openverse/Wikimedia coverage for obscure or highly specific dishes may be
  thin; the search node handles this by returning fewer candidates rather
  than failing, but very obscure prompts may be hard to ground in real
  references at all.
- Cursor SDK's vision capability for reading local image files (needed for
  `screenReferences` and `writeGenerationPrompt`) has not yet been exercised
  in this codebase — first implementation pass should confirm it directly
  before building the rest of the pipeline on top of it.
