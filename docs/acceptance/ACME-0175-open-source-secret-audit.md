# ACME-0175 — open-source credential audit

Status: Verified, scoped
Date: 2026-08-26
Task: ACME-0175
Pulled baseline: `626eff2`

## Claim this record is allowed to make

At the audited task state, no environment file or high-confidence provider
credential is present in ACME's tracked tree or any reachable Git revision.
The one local credential-bearing environment file is ignored and untracked.
This is strong content-redacted repository evidence, not proof that every
possible secret shape can be recognized by pattern matching.

## Scope and method

The audit ran after a fast-forward pull of `origin/main` and covered:

- every tracked path in the current tree;
- every local file whose name begins with `.env`, with contents classified in
  memory and never printed;
- all 227 revisions reachable through `git rev-list --all`;
- historical path names for added, copied, modified or renamed environment
  files;
- text blobs for boundary-aware signatures representing OpenAI/Anthropic-style
  keys, GitHub tokens, AWS access-key IDs, Google API keys, Slack tokens,
  Stripe secret keys and private-key blocks; and
- generic assignments to API-key, token, client-secret, private-key and
  password variable names, narrowed by path and reviewed without emitting the
  assigned values.

Binary files were included in the path inventory but excluded from text-regex
matching. No dedicated external scanner such as Gitleaks or TruffleHog was
installed; the audit used Git path/object traversal and boundary-aware regular
expressions. Those limitations are why the result is scoped rather than an
absolute absence claim.

## Results

| Check | Content-redacted result |
| --- | --- |
| Tracked `.env*` paths at task state | 0 |
| `.env*` paths in reachable history | 0 |
| Local `.env*` files | 1 |
| Local environment-file state | `.env.local`: ignored, untracked |
| Local credential classification | `OPENAI_API_KEY`: credential-like value present; value not emitted |
| High-confidence current-tree signature hits | 0 |
| High-confidence all-revision signature hits | 0 across 227 revisions |
| Generic assignment paths at task state | 5, all reviewed |
| Historical generic-assignment surface | 27 unique text blobs across 5 paths |
| Confirmed provider/API credentials in tracked content or history | 0 |

The five generic-assignment paths are runtime environment reads in the two
local startup scripts, an operations example, a setup-guide ellipsis
placeholder and an explicitly synthetic local-development password in the
frozen workbench composition. The historical literal variants reduce to that
same synthetic development credential and setup placeholder. None matches a
provider, platform-token or private-key signature.

The ignored `.env.local` was left untouched because it is expected local
configuration and there is no evidence that its credential entered Git. Its
value was not copied into this record, console output or repository files.

## Required response to a future finding

A confirmed real credential in tracked content is a release blocker. Remove it
from the current tree, stop further distribution, notify the owner without
repeating the value, rotate or revoke it at the provider, and assess reachable
history and downstream clones. Rewriting or deleting repository content is not
credential revocation and requires separate destructive-action authority.

## Distribution conclusion

The audit found no credential exposure that blocks the Apache-2.0 source
distribution decision in [ADR-0052](../adr/0052-apache-2.0-open-source-distribution.md).
It authorizes no package publication, deployment, release tag or push by
itself.
