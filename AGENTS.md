# Workflow Integration: spec-kit + superpowers

This project combines **GitHub `spec-kit`** (Spec-Driven Development) and **`superpowers`** (engineering execution discipline). You MUST follow this division of responsibilities to avoid conflicting workflows or duplicate artifacts.

## 1. Source of Truth & Artifact Ownership
- **`spec-kit` owns all project governance, specifications, architecture, and task lists:**
  - Project principles: `.specify/memory/constitution.md`
  - Feature artifacts: `specs/<feature>/` (`spec.md`, `plan.md`, `tasks.md`, and related design docs)
- **DO NOT duplicate plans:** Never use superpowers' `writing-plans` skill to create parallel plans in `docs/plans/` for features managed by `spec-kit`. Always treat `specs/<feature>/tasks.md` as the single execution backlog.
- **Keep specs in sync:** If implementation uncovers technical constraints that require changing the design, update `specs/<feature>/plan.md` (and `spec.md` if behavior changes) before completing the branch.

## 2. Phase-by-Phase Routing
1. **Ideation (Optional, for ambiguous features):**
   - Use superpowers' `brainstorming` skill to explore requirements, trade-offs, and edge cases before drafting a formal spec.
2. **Specification, Planning & Task Breakdown (`spec-kit`):**
   - Use `spec-kit` commands (`/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.analyze`) to produce and validate all feature artifacts.
3. **Workspace Isolation (`superpowers`):**
   - Use `using-git-worktrees` when isolating feature work on a clean branch.
4. **Implementation (`superpowers` executing `spec-kit` tasks):**
   - Read tasks directly from `specs/<feature>/tasks.md`.
   - Prefer `subagent-driven-development` (fresh subagent per task + two-stage review: spec compliance against `spec.md`, then code quality).
   - Strictly enforce `test-driven-development` (Red -> Green -> Refactor) for all production code.
5. **Debugging, Verification & Completion (`superpowers`):**
   - Use `systematic-debugging` for any test failures or bugs—never guess or apply band-aid fixes.
   - Run `verification-before-completion` (execute real test, lint, and build commands and inspect output) BEFORE checking off any item (`[x]`) in `tasks.md` or claiming work is complete.
   - Use `requesting-code-review` (verifying full compliance with `spec.md` and `constitution.md`) and `finishing-a-development-branch` to finalize the PR/merge.

## 3. Scope Exception (Lightweight Tasks)
- For minor bug fixes, small refactors, or chores that do not alter product behavior or architecture, skip `spec-kit` and execute directly with `superpowers` (`systematic-debugging`, `test-driven-development`, `verification-before-completion`).