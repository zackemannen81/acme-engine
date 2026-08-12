# @acme/adapter-evidence-auth-supabase

ADR-0035 credential adapter for self-hosted Supabase Auth.

It performs password/refresh/logout calls behind an injected `fetch`, verifies
access tokens against remote JWKS with ES256, issuer and `authenticated`
audience constraints, and requires stable subject/session claims. Access-token
lifetime is capped at 15 minutes. Tokens are returned only to the server-side
session service and never to browser code.

The default suite uses a generated keypair and mocked transport. The explicit
`pnpm test:supabase-auth` gate requires dedicated environment credentials and
otherwise refuses to run.
