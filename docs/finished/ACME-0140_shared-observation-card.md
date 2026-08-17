# ACME-0140 — Shared observation card

Task ID: ACME-0140
Status: Complete
Owner: Claude
Created: 2026-08-16
Charter frozen at: 2026-08-16

## Goal

Changing the observation card once changes how source review and the
ledger present an occurrence.

## Delivered

`evidence-observation-card/1` and `buildEvidenceObservationCard`. Source
review and ledger embed the card. The browser renders quote, citation
and standing from `card`.

## Verification

unit 788/788; conformance 78; integration 70; scenario 26; typecheck
and lint clean.
