# V2 chains: one degenerate subject label reaches the resume pointer

Status: Resolved / not applicable. Not activated. Observed during ACME-0157.

## Discovery context

The ACME-0157 status surface answers "where do I resume" by naming the first
instance with no committed extraction, ordered by chain ordinal then instance
ordinal. On the ACME-0156 case over the real `source-A` binder it named:

```text
Next: , Anonym, , · instance #1 — one of 467 with no committed extraction.
```

The label is what `evidence-v2-chain/1` derived and stored, and the status
surface reported it faithfully. Measured against the stored rows:

```text
351 chains total
  1 whose subject label is empty apart from punctuation and "Anonym"
```

That one chain is `chain-000001`, holds a single instance, and sorts first
because chain ordinals follow proposal order. So the single least useful chain
in the case is the one a person is sent to first.

## Proposed outcome

Two candidate changes, and the choice is the work rather than a detail:

1. The chain layer declines to name a subject it cannot read, and the label
   becomes an explicit unknown rather than the punctuation left over from a
   failed parse. This changes `evidence-v2-chain/1` and therefore every chain
   identity, so it belongs in its own task with its own recorded run.
2. The resume ordering prefers a chain whose subject is known, and reports the
   unnamed one separately. This changes no stored identity and is cheap, but it
   hides a structure defect behind a sort order.

Preference is 1, with 2 rejected on the grounds that a resume pointer should
not compensate for a label the layer below should not have produced.

## Why it is outside the ACME-0157 charter

ACME-0157's Out of Scope forbids any change to `evidence-v2-chain/1` or its
rule version, and its Definition of Done requires the resume pointer to name a
concrete instance — which it does. The pointer is correct; the label it repeats
is the finding. Nothing about the shell or the status projection needs to
change for this.

## Impact assessment

Small and visible rather than silent. One chain of 351, one instance of 467,
and it is a display and ordering nuisance rather than a provenance error: the
instance still resolves to its exact source lines, and no occurrence, quote or
locator is affected. R-02 is not regressed — the label still comes from the
document body, and the body is what failed to supply a name.

## Dependencies

- Option 1 changes `EVIDENCE_V2_CHAIN_RULE_VERSION` and every derived chain and
  membership identity, so it requires a fresh import and a recorded comparison
  of chain, instance and unassigned-part counts before and after.

## Suggested verification

- A fixture whose body carries no readable subject yields an explicit unknown
  label rather than residual punctuation.
- A recorded run over the real binder comparing the 351/467/5 chain, instance
  and unassigned-part figures before and after.
- The status surface's resume pointer names a chain a person can act on.
