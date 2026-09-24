# Agent workflow

Local tool to run **engineer** agents on feature specs in isolated git worktrees, with a small monitoring UI.

## Quick start

1. Copy [`.env.example`](.env.example) to `agent-workflow/.env` and set `CURSOR_API_KEY`.
2. Optional in the same file: `AGENT_WORKFLOW_ENGINEER_MODEL`, `AGENT_WORKFLOW_MAX_CONCURRENT`, `AGENT_WORKFLOW_PORT`.
3. Install and run:

```bash
cd agent-workflow
npm install
npm run dev
```

- API: `http://localhost:3001` (or `AGENT_WORKFLOW_PORT`)
- UI: `http://localhost:5174` (or `VITE_AGENT_WORKFLOW_PORT`)

Headless (watcher + API only): `npm run worker`

## Engineer PR flow

Each engineer run expects:

- **[GitHub CLI](https://cli.github.com/)** (`gh`) authenticated (`gh auth login`)
- Permission to **push** `feature/*` branches to `origin`
- The repo [PR template](../.github/pull_request_template.md) on the branch the worktree was created from

The agent commits in the worktree, pushes, and opens a PR against **`main`** using the template (see [`personas/engineer.md`](personas/engineer.md)).

## Drop-a-spec workflow

1. Add `my-feature.md` to [`ready-spec/`](ready-spec/).
2. The watcher moves it to `specs/in-progress/`, creates `.worktrees/my-feature` on `feature/my-feature`, and queues the engineer.
3. Watch progress on the dashboard or in `data/logs/my-feature.log`.
4. On success, the spec moves to `specs/done/`.

Ignored in the inbox: `README.md`, `*.example.md`.

## CLI

```bash
npm run feature -- list
npm run feature -- status <job-id>
npm run feature -- reconcile
npm run feature -- run <job-id>    # retry failed/done manual re-run
```

## Smoke test (two parallel specs)

1. `npm run dev`
2. Copy two small specs into `ready-spec/` (different filenames).
3. Confirm both appear as jobs; with `AGENT_WORKFLOW_MAX_CONCURRENT=2` they can run in parallel.
4. Confirm specs land in `specs/done/` when agents finish.

## Layout

| Path | Role |
|------|------|
| `ready-spec/` | Inbox |
| `specs/in-progress/` | Active builds |
| `specs/done/` | Completed specs |
| `data/` | Job registry + logs (gitignored) |
| `personas/engineer.md` | Engineer system prompt |
