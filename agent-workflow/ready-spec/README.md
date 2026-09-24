# Ready spec inbox

Drop a feature spec here as `your-feature-name.md` (not `README.md`).

When `npm run dev` (or `npm run worker`) is running, the watcher will:

1. Move the file to `specs/in-progress/`
2. Create a git worktree at `.worktrees/<slug>` on branch `feature/<slug>`
3. Queue the engineer agent to implement the spec

On success, the spec moves to `specs/done/`.
