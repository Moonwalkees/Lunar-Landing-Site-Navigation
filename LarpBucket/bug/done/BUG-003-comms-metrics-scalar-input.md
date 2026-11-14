# BUG-003 Comms metrics reject scalar clearance input

Status: done
Owner: Tam Nguyen
Severity: low
Affects: backend model / comms metrics

## Summary
`comms_metrics` fails when callers pass one scalar clearance value.

## Description
`np.asarray` creates a zero-dimensional array for scalar input, then indexing it with `current_index` fails.

## Intended behaviour
Treat a scalar clearance as a one-sample time series.

## Where it happens
`comms_metrics` in `backend/app/utils.py`.

## Cause
The function assumes a one-dimensional input without normalizing scalar input.

## File
`backend/app/utils.py:141`

## Solution
**Chosen:** `comms_metrics` wraps scalar input into a one-sample array in `backend/app/utils.py`.

**Strengths**
- Scalar and one-dimensional time-series callers both work.
- Higher-dimensional input remains invalid instead of being silently flattened.

**Limitations**
- Multi-dimensional data requires caller-side reduction to a time series.

**Alternatives considered**
Flattening with `reshape(-1)` was rejected because it could hide a malformed matrix input.
