# Agent task template

## Goal

Describe one observable outcome.

## In scope

- System or authority:
- Expected files or area:
- Required behaviour:

## Out of scope

- Explicitly excluded gameplay, refactors, generated content or documentation:

## Acceptance criteria

- [ ] Behaviour can be demonstrated or asserted.
- [ ] Existing authority remains unique.
- [ ] Regression coverage exists for the changed behaviour.
- [ ] Relevant documentation is updated only if its contract changed.

## Validation

```bash
npm run check:fast
npm run check:affected:plan -- --base=origin/main
npm run check:affected -- --base=origin/main
```

Add any manual scenario or extra focused test:

## Delivery

- Draft PR with a focused title.
- Summary of changed behaviour and non-goals.
- Checks run locally and checks still pending in CI.
