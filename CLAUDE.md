# CLAUDE.md

> **To any Claude agent reading this:** this file is deliberate. Several teammates run their own Claude Code sessions on this repo at the same time. The rules below exist so that concurrent work stays coordinated and nobody duplicates or clobbers anyone else's work. Follow them in every session.

## Project docs (source of truth)
- [doc/scope.md](doc/scope.md): what we are building and the model math
- [doc/tech-stack.md](doc/tech-stack.md): the agreed stack, repo layout and **numbered build order**

Do not change the agreed stack or scope on your own. If something in them looks wrong, raise it with the user.

## Commits
Never add Claude as a co-author, and never add Claude or AI attribution lines to commits or PRs.

## Your role: PM of `LarpBucket/`
Act as project manager for a local folder called `LarpBucket/` at the repo root. Create it if it doesn't exist.

```
LarpBucket/
  feature/
    done/
  bug/
    done/
```

Open and in-progress tickets live directly in `feature/` or `bug/`. Tickets with `Status: done` live in that folder's `done/` subfolder.

### Workflow
1. **Before starting work**, read the tickets in `LarpBucket/`. Pick a ticket whose status is `open`, or ask the user which one to take.
2. **Claim it**: set `Status: in-progress` and `Owner: <user's name>` before editing any code, so other agents can see it is taken. Never work on a ticket another owner holds as `in-progress`.
3. **When done**, set `Status: done`, add a one-line note of what changed, fill in the ticket's `## Solution` section (see [Solution section](#solution-section)), and move the ticket into the `done/` subfolder (`git mv LarpBucket/feature/<ticket>.md LarpBucket/feature/done/`, likewise for bugs). Update any links to it.
4. **When a feature is missing tickets**, break it down from the docs into new feature tickets.
5. **When you find a bug** (yours or someone else's), file a bug ticket. Fix it only if it's in scope of your current work or the user asks you to.
6. Keep tickets small, factual and faithful to the docs. Don't invent features that aren't in scope.md or tech-stack.md.

### Feature tickets
Path: `LarpBucket/feature/<step>.<n>-<short-slug>.md`, e.g. `LarpBucket/feature/2.1-skyline-single-site.md`.

- `<step>` is the build-order step number in [doc/tech-stack.md](doc/tech-stack.md) (1 = data + ephemeris, 2 = horizon, 3 = model + API, 4 = frontend, 5 = deploy).
- `<n>` counts up within that step. Check the existing tickets, including those in `done/`, for the next free number.
- Each ticket should be a manageable, practical bite: one focused piece of work a person can finish in one sitting.

Template:
```markdown
# <step>.<n> <Title>

Status: open | in-progress | done
Owner: <name or blank>
Source: <doc + section this comes from, e.g. scope.md > Core 4 Metrics>

## Description
What to build and why, faithful to the docs.

## Expected user interaction
What the user does and sees once this is done. For backend-only work, describe what the caller sends and gets back.

## Done when
- Concrete, checkable outcomes

## Solution
_Filled in when the ticket is done. See "Solution section" below._
```

### Bug tickets
Path: `LarpBucket/bug/BUG-<nnn>-<short-slug>.md`, numbered in order (count `bug/done/` too), e.g. `LarpBucket/bug/BUG-001-battery-goes-negative.md`.

Template:
```markdown
# BUG-<nnn> <Summary>

Status: open | in-progress | done
Owner: <name or blank>
Severity: critical | high | medium | low
Affects: <part of the app, e.g. backend model / panorama chart / API>

## Summary
One line.

## Description
What goes wrong and how to reproduce it.

## Intended behaviour
What should happen instead.

## Where it happens
The function, endpoint or screen where it shows up.

## Cause
Root cause if known, otherwise "unknown" plus your best lead.

## File
`path/to/file.py:line`

## Solution
_Filled in when the ticket is done. See "Solution section" below._
```

Severity guide:
- **critical**: app crashes or gives wrong core numbers
- **high**: a core feature is broken
- **medium**: wrong in some cases or has an awkward workaround
- **low**: cosmetic

### Solution section
Every feature and bug ticket gets a `## Solution` section before it moves to `done/`. It records why the work was done this way, so teammates and later agents don't redo the decision or reopen options that were already rejected. Keep it short and concrete, and name real files, functions and libraries.

```markdown
## Solution
**Chosen:** What was built or changed, and where (`path/to/file.py`).

**Strengths**
- Why this approach fits the docs and the problem.

**Limitations**
- Known gaps, edge cases it doesn't handle, assumptions it relies on.

**Alternatives considered**
| Option | Why not chosen | Trade-off vs chosen |
|---|---|---|
| <other approach> | <reason> | <what it would have gained or lost> |
```

If there was really only one sensible approach, say so in one line under **Alternatives considered** instead of inventing options.
