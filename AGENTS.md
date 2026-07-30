# AGENTS.md

## Scope

These instructions apply to the entire repository.

## Orientation and implementation

- Start with `docs/AGENT_DEVELOPMENT.md`, then inspect only the affected authority, its composition point and focused tests.
- Before editing, state the authoritative system, intended files, acceptance criteria and explicit non-goals.
- Use `rg` to locate symbols and composition. Do not scan or rewrite the whole repository to understand one subsystem.
- Do not introduce a second gameplay loop, persistence owner, input reader or generated-city authority.
- For broad requests, use `docs/templates/AGENT_TASK.md` to define a single bounded implementation before changing code.

## Validation

- Run `npm run check:fast` before the first push.
- Review `npm run check:affected:plan -- --base=origin/main`, then run `npm run check:affected -- --base=origin/main`.
- Treat the affected-test plan as a conservative minimum. Add a focused test manually when a change crosses a boundary that filenames cannot reveal.
- Run `npm run test:rc` only for cross-cutting/test-infrastructure changes, release candidates or an explicit request.

## Pull requests

- Keep each pull request focused on one concern. Do not mix gameplay, generated city changes, documentation cleanup, and CI maintenance unless the task explicitly requires it.
- Prefer a small number of meaningful commits. Do not create empty commits or repeatedly push merely to re-trigger CI.
- Before pushing, run the narrowest relevant local checks. Run the complete release-candidate suite only when the change or requested validation justifies it.
- After pushing, create or update the pull request promptly and report its URL and current validation state.

## GitHub Actions and waiting

- Never wait passively for GitHub Actions while independent work remains. Continue review, documentation, or other validation that does not depend on the pending result.
- Treat CI observation as a bounded operation: inspect once after the push, then make at most one short follow-up check in the same turn unless the user explicitly asks you to monitor until completion.
- Do not use unbounded polling loops. Any command that watches checks must have an explicit timeout of at most five minutes and produce progress at least once per minute.
- A running check is not a reason to withhold the pull-request handoff. Report that CI is pending, identify the jobs still running, and stop cleanly when no further action is possible.
- If a check fails, inspect the failing job and logs before retrying. Re-run only the failed job or failed jobs when the failure is plausibly transient; do not restart the whole workflow by default.
- Superseded runs are cancelled automatically. Do not wait for or investigate a cancelled run when a newer run exists for the same pull request.
