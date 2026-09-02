# Verification: feishu-bitable-export

<!-- agent-skill-verification: {"clean": false, "commit": "uncommitted", "fingerprint": "59f4746160baf07b6cdb06495c4004dc84bc2187da3fd2c2bb621c4a71ae0c8f", "version": "1.0.0"} -->

Generated: 2026-09-02T10:21:36Z

## Release evidence

- Run type: representative
- Recorded execution environments: macos
- Cross-environment compatibility: not established by this report
- Eval rollout: 0 passed, 0 failed, 0 errored, 0 regressed
- Representative live export: PASS — this package completed `npm ci`, then an isolated headless browser export; the bundled workbook checker confirmed a valid one-sheet workbook with frozen header, autofilter, preserved hyperlinks, and zero Excel error values. Source URL, identifiers, row counts, and source records are not retained in this package.

## Gates

- PASS — specification
- PASS — security
- PASS — skill graph

## Interpretation

This report records only the checks completed at generation time. It does not prove
future live data, model output, other agent runtimes, or production user outcomes.
Run `python3 scripts/evolve.py` after a correction or material dependency change.
