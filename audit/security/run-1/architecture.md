# Béa (beabuddy) — architecture for security review

**Commit reviewed:** 56cb8fa, clean worktree. Profile `standard`, whole repository in scope.

## Product and principals

A collaborative travel app: users create trips, invite others to join them, and keep
itineraries, stops, budgets, todos, packing lists, expenses with receipts, photo
memories and an encrypted document vault. Principals are the anonymous visitor, the
signed-in user, the trip member (role `editor`), the trip owner, and the
service-role backend identity. Protected resources are per-user private content
(vault, photos, receipts, preferences) and per-trip shared content.

## Stack and deployment

TanStack Start (React 19, Vite) with Nitro. **The nitro preset is `node-server`** —
`vite.config.ts` states plainly that the host, Canner, is a Node host and not
Cloudflare. This matters for the SSRF finding: the server process has a real
loopback and private network, which an edge-worker runtime would not. Persistence,
auth, storage and realtime are all Supabase. There are no edge functions; all
server-side logic is TanStack server functions plus 29 SQL migrations.

`node_modules` is absent in the audit environment and the skill forbids installing
dependencies, so no build, unit test or type check was run. All evidence is source
reading plus one offline harness that transcribes a guard function verbatim.

## Entry surfaces

1. **17 server functions** across 10 `src/lib/*.functions.ts` files, invoked as RPC.
2. **`/api/tile/:z/:x/:y.png`**, handled in `src/server.ts` ahead of the router.
   This is the only unauthenticated outbound fetch.
3. **Direct PostgREST access.** The browser holds a Supabase client and talks to
   tables directly, so every table is an entry surface and RLS is the real control.
4. **Realtime presence topics** `trip-presence:<uuid>`.
5. **Storage buckets** `photo-memories` and `receipts`.

## Trust boundaries and their strongest control

| Boundary | Control | Verdict |
|---|---|---|
| Anonymous → signed-in | `requireSupabaseAuth` calling `getClaims` | Sound; all 17 server fns carry it |
| Signed-in → other users' rows | RLS on all 23 tables | Sound; no `USING (true)` |
| Signed-in → other trips | `is_trip_member` | **One hole — see F-1** |
| Signed-in → own files only | `storage.foldername(name)[1] = auth.uid()` | Sound |
| Server → internal network | `isPublicHttpsUrl` string guard | **Bypassable — see F-2** |
| Client bundle → secrets | `.server.ts` modules + lazy proxy | Sound |
| Cross-site → server fns | `createCsrfMiddleware` re-registered | Sound |

## What the codebase already gets right

This is a well-hardened target and most of the obvious classes are genuinely closed.
RLS is enabled on every table with no permissive policy; all seven `SECURITY DEFINER`
functions set `search_path` and revoke `EXECUTE` from `PUBLIC` and `anon`; the
service-role key is confined to server-only modules behind a lazy proxy and every
admin query filters on the verified token subject; the tile proxy parses rather than
trusts its path; invites already have expiry, single-use defaults, revocation and a
rate limit; presence channels were deliberately moved to RLS-gated private topics.
Several migrations carry comments naming the specific attack they close. Both findings
below are gaps in controls that were consciously designed, not missing controls.
