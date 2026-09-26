# ADR-0003: Server-authoritative coaching sessions and hidden material

- Status: Accepted
- Date: 2026-09-25

## Context

The product must prevent the model, or an adversarial user, from skipping
the learning flow or extracting protected answers. Prompt instructions alone
cannot guarantee this.

## Decision

- Phase, hint level, reveal and decision live in `coaching_sessions` and
  change only through `/api/v1/sessions/*` handlers that call the pure state
  machine in `packages/core` and persist the result.
- Hidden exercise material (`ExerciseHidden`) is loaded only inside the API
  and released to clients exclusively through `releaseHiddenMaterial`.
- The coach prompt never contains the solution before the state releases
  it; coach-only guidance is included with a do-not-disclose rule, but
  authorisation does not depend on the model obeying it.
- The AI may propose transitions in later phases; the server validates
  every proposal with the same machine.

## Consequences

- Every learning-state change is a server round-trip. Accepted for
  integrity.
- The machine is unit-tested independently of the database (25 tests) and
  the release gate is covered by API tests that assert hidden fields are
  absent until earned.
