# Security audit — Béa (beabuddy)

**Target:** `larochellemathildeeva-oss/beabuddy` at commit `56cb8fa`, clean worktree
**Profile:** `standard`, whole repository in scope
**Date:** 2026-09-20
**Method:** source-first review, no network probing, no database reached, no target code executed
**Status:** both findings were fixed in commit `ff5d666`; this report describes the code as it stood at `56cb8fa`

## Coverage statement

**This is one pass and does not exhaust the target.** No prior audit ledger exists
for this repository, so nothing here builds on earlier coverage. Thirteen coverage
units were seeded; eleven were reviewed and two were deliberately left unassigned:

- `src/lib/ai.server.ts` and the prompt-assembly path for the AI endpoints
- `src/lib/vaultCrypto.ts` key derivation and key storage

The AI unit is the higher priority of the two for a follow-up, because F-2 below
establishes that attacker-influenced page text reaches a model prompt through
`parseRecoList`.

Two environment limits shaped the evidence. `node_modules` is not installed and the
method forbids installing dependencies, so no build, test or type check was run. The
audit container has no IPv6 stack, so the connection half of F-2 could not be
observed locally; that residual is recorded in `NEEDS-VALIDATION.md`.

## Findings

| ID | Severity | Title |
|---|---|---|
| F-1 | **High** | Any authenticated user can join an arbitrary trip by re-pointing their own invite row at it |
| F-2 | **Medium** | SSRF guard on pasted links is bypassable with IPv6-mapped literals and with DNS names resolving to private addresses |

### F-1 — Invite row can be re-pointed at another trip (High)

`public.trip_invites` grants `UPDATE` to `authenticated` table-wide, and the RLS
policy `"Members revoke invites"` has a `WITH CHECK` clause whose first disjunct,
`invited_by = auth.uid()`, is unaffected by a change to `trip_id`. The membership
branch is therefore never evaluated against the new value. A user can create an
invite for a trip they legitimately belong to, repoint that row at any other trip's
UUID, and redeem their own unchanged code. `accept_trip_invite()` is
`SECURITY DEFINER` and keys only on the code, so it inserts the caller into
`trip_members` for the victim trip as `editor`.

The policy authorizes the editor when it needed to constrain the edit.

This re-opens the hole that `20260905223000_lock_trip_member_insert.sql` was written
to close — its own comment reads *"F-01: stop any signed-in user from self-joining a
trip they know the UUID of."* Revoking the direct `INSERT` grant on `trip_members`
does not help, because the definer function performs the insert.

The limiting precondition is knowing the victim trip's UUID, which is a random v4 and
is not enumerable through RLS. The cleanest exploit profile is a **former member**:
they keep the UUID, are no longer in `trip_members`, and can re-grant themselves
`editor` at will. Removal from a trip is therefore not enforceable.

**Fix:** make the `WITH CHECK` a conjunction that always tests the new `trip_id`
through `is_trip_member`, and add a `BEFORE UPDATE` trigger rejecting any change to
`trip_id`. Narrowing the grant to `GRANT UPDATE (revoked_at, expires_at, max_uses)`
is a worthwhile second layer. Full SQL is in `FINDINGS-DETAIL.md`.

### F-2 — SSRF guard decides on hostname spelling, not on the address (Medium)

`parsePlaceLink` and `parseRecoList` let any signed-in user hand the server an
arbitrary https URL to fetch. The paste path does not filter hosts —
`isLikelyPlaceHost` only *ranks* candidates and never rejects one — so the sole
defence is `isPublicHttpsUrl`, which inspects the hostname as a string. Two gaps:

1. The IPv4-mapped IPv6 branch matches `::ffff:` followed by a **dotted quad**, but
   the WHATWG URL parser canonicalizes `[::ffff:127.0.0.1]` to `[::ffff:7f00:1]` in
   hex. That regex can never match, so the branch is unreachable dead code. The
   loopback literal is admitted, as are `[::ffff:a9fe:a9fe]` (169.254.169.254) and
   the unspecified address `[::]`.
2. Nothing ever resolves the hostname, so any public DNS name pointing at loopback or
   RFC1918 passes, as does a rebind between check and connect. The per-hop redirect
   re-check uses the same string-only predicate, so an attacker-controlled public host
   can simply 302 to one of these.

The host is a Node server, so loopback and link-local really are reachable.

Two things bound the impact honestly. The scheme is forced to https, so plain-HTTP
internal services — including the usual cloud metadata endpoint — are not directly
reachable; the target must speak TLS. And the request is a capped GET. But the
response is **partially reflected**: `parsePlaceLink` returns `og:title`,
`twitter:title` and `<title>` to the caller, and `parseRecoList` feeds the fetched
page text to the model. This is a narrow read channel, not blind SSRF.

**Fix:** resolve the host, reject any answer in loopback, link-local, unique-local,
unspecified, CGNAT or RFC1918 space including IPv4-mapped forms, and pin the
connection to the vetted address so the name cannot rebind — in Node, via a custom
`lookup` on the agent. Normalizing the IPv6 hostname and adding `::` is a worthwhile
stopgap, but string matching cannot close the DNS vector; an egress allowlist or a
dedicated fetch proxy is the durable control.

## What was checked and found sound

Recorded so a future run knows what this pass actually established, not as a claim
that these areas are exhausted:

- **Authentication.** All 17 server functions carry `requireSupabaseAuth`, which
  verifies the token through `getClaims` and rejects on error, missing claims or
  missing `sub`. CSRF middleware is explicitly re-registered in `src/start.ts`.
- **Service-role usage.** Confined to account erase and delete. Every admin query
  filters on `context.userId` from the verified token; no user-supplied identifier
  reaches one. The key is read only in a `.server.ts` module behind a lazy proxy,
  imported dynamically inside handlers.
- **RLS generally.** Enabled on all 23 tables, no `USING (true)`, all seven
  `SECURITY DEFINER` functions set `search_path` and revoke `EXECUTE` from `PUBLIC`
  and `anon`.
- **`reco_shares`.** Checked specifically for the F-1 pattern; the pivot is closed
  there because both policies constrain the row through `owner_id`.
- **Storage.** All verbs on both buckets bind the first path segment to `auth.uid()`.
  The `UPDATE` policies give only `USING`, which Postgres also applies as
  `WITH CHECK`, so an object cannot be renamed into another user's prefix.
- **Realtime presence.** The topic regex is anchored and yields NULL otherwise, so
  `is_trip_member(NULL, uid)` denies by default. Note this is reached through
  membership, so F-1 also grants presence access.
- **Tile proxy.** Anchored digits-only regex, `Number` coercion, range check against
  2^z, fixed upstream origin. Not user-steerable.
- **Client-side injection.** One `dangerouslySetInnerHTML`, argument is a
  module-level constant. No `innerHTML`, `eval` or `new Function` under `src`.
- **Secrets.** No live credential tracked; `.env.example` is the only committed env
  file and its values are empty. Only the two intended-public `VITE_` values reach
  the client bundle.

## Recommended order of work

1. **F-1** — a one-migration fix that closes a cross-tenant hole with real
   consequences for a shared-trip product.
2. **F-2** — replace the string guard with resolve-and-pin.
3. **Assign the two deferred units**, starting with the AI prompt path, since F-2
   shows attacker-influenced text reaches a prompt.
