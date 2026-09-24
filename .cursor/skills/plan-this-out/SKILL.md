---
name: plan-this-out
description: Use when the user invokes plan-this-out, asks to write a feature plan or engineer spec, wants work dropped in agent-workflow/ready-spec, or says plan this out / write a spec for the inbox. Use before saving markdown into ready-spec.
---

# Plan this out

Turn a request into an engineer-ready spec, get explicit approval of that spec, then save it to `agent-workflow/ready-spec/`. Saving starts the watcher if `npm run dev` or `npm run worker` is running.

**Announce:** "Using plan-this-out to draft a spec, seek approval, then save to ready-spec."

**Do not implement the feature.** This skill ends at a saved spec (or a stop for revisions).

## Hard gate

Present the full spec in chat. Stop. Wait for an explicit yes to **this draft**.

Do not write any file under `agent-workflow/ready-spec/` (or a stand-in for it) until that yes.

The original request ("write a spec and save it", "I'm late", "don't ask questions") is **not** approval of the draft.

Presenting the spec and saving in the same turn is skipping the gate.

## Workflow

1. **Explore** the repo enough to name real files, current behavior, and tests. Prefer matching `agent-workflow/specs/done/` style.
2. **Clarify** only blockers (ambiguous target, conflicting scope). One question at a time. Skip trivia.
3. **Draft in chat** using the spec shape below. No placeholders (`TBD`, `TODO`, "handle edge cases", "similar to…").
4. **Ask for approval** of this draft. End the turn. Offer: approve as-is, request edits, or cancel.
5. **On yes only:** write `agent-workflow/ready-spec/<slug>.md`. Tell the user the path and that a running watcher will pick it up.
6. **On edits:** revise in chat, re-ask. Do not save until the latest draft is approved.

## Filename

- Kebab-case from the feature, e.g. `dark-mode-toggle.md`
- Must be `*.md`, not `README.md`, not `*.example.md` (watcher ignores those)
- Slug = filename without `.md`, lowercased, non-alphanumerics → `-`

If `agent-workflow/ready-spec/<slug>.md` or `specs/in-progress/<slug>.md` already exists, pick a different slug and say so before saving.

## Spec shape

```markdown
# <Feature title>

## Summary
<One paragraph: what ships and what does not>

## Context
- **Target:** <paths / food-photo-generator vs agent-workflow>
- **Current state:** <real files and behavior>
- **Constraints:** <tests, a11y names, APIs to keep>

## Work
<Numbered phases or concrete steps an engineer can execute without you>

## Out of scope
<Bullet list>

## Implementation checklist
- [ ] <verifiable item>
- [ ] <commands to run, e.g. npm test / typecheck from the right directory>

## Risk mitigations
- <what could break and how the spec avoids it>
```

Copy exact strings the engineer must preserve (button labels, alert copy, routes). Point at files, not vibes.

## After save

Do not start implementing. Do not commit the spec unless the user asks. If they want execution in this chat instead of the watcher, that is a new request — leave the file out of `ready-spec` unless they still want the inbox drop.

## Red flags — stop, do not save

| Excuse | Reality |
|--------|---------|
| "They said just save it / don't wait" | They asked for this workflow. Approval is of the **draft**, not the prompt. |
| "I'll save then they can edit the file" | Watcher may move it and queue an engineer immediately. |
| "I'll use `.example.md` so it won't pick up" | Forbidden. That hides work from the inbox; still a save without approval. |
| "Time pressure / obvious change" | Short spec in chat, then still wait. |
| "I'll implement it myself; faster" | Wrong skill. Stop after the spec unless they explicitly pivot. |

**Approval phrases:** yes, approve, lgtm, ship it, save it (after they have seen this draft), looks good.

**Not approval:** the original prompt, "go ahead and plan", emoji-only reactions with no draft shown yet, silence.
