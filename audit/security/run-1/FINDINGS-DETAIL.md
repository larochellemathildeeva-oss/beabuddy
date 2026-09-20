# Findings detail
Generated from `findings.json`; every claim below is that record's text.
## F-1 — Any authenticated user can join an arbitrary trip by re-pointing their own invite row at it
- **Fingerprint:** `rls/trip_invites/update-policy-trip_id-pivot`
- **Severity:** high (likelihood medium, impact high)
- **Confidence:** high

### What it is

The RLS UPDATE policy on public.trip_invites accepts a row edit whenever the editor is the invite's creator, without re-checking membership of the NEW trip_id. Because authenticated holds a table-wide UPDATE grant and trip_id is not protected by any trigger, rule or column grant, a user can create an invite for a trip they legitimately belong to, UPDATE that row to point at any other trip's UUID, and then redeem their own code. accept_trip_invite() is SECURITY DEFINER and keys only on the code, so it inserts the caller into trip_members for the victim trip with role 'editor'. This re-opens the self-join hole that migration 20260905223000_lock_trip_member_insert.sql was written to close: revoking the direct INSERT grant on trip_members does not help, because the definer function performs the insert.

### Root cause

The WITH CHECK clause of "Members revoke invites" is a disjunction whose first branch, invited_by = auth.uid(), is unaffected by a change to trip_id, so the membership branch is never evaluated for the new value. The policy authorizes the editor rather than constraining the edit.

### Intended behavior

An invite row must stay bound to a trip the editor is a member of. The INSERT policy already enforces this with is_trip_member(trip_id, auth.uid()); the UPDATE path must enforce the same invariant on the post-update row, and trip_id should not be reassignable at all.

### Trace

| Kind | Location | Scope | Note |
|---|---|---|---|
| entrypoint | `supabase/migrations/20260904235145_7956542c-41b8-41d7-b723-0695d42ea0b4.sql:39` | GRANT on public.trip_invites | Table-wide GRANT UPDATE to authenticated makes every column, trip_id included, writable through PostgREST. |
| propagation | `supabase/migrations/20260907010000_harden_trip_invites.sql:40` | policy "Members revoke invites" WITH CHECK | WITH CHECK is satisfied by invited_by = auth.uid() alone, so the new trip_id is never tested for membership. |
| sink | `supabase/migrations/20260907010000_harden_trip_invites.sql:94` | accept_trip_invite() | SECURITY DEFINER insert into trip_members using the row's trip_id, with no check of who created the invite. |

### Evidence

- `supabase/migrations/20260907010000_harden_trip_invites.sql:40` — WITH CHECK ( invited_by = auth.uid() OR EXISTS (SELECT 1 FROM trip_members ...) ) - the first disjunct holds after a trip_id change.
- `supabase/migrations/20260907010000_harden_trip_invites.sql:76` — accept_trip_invite selects the row WHERE code = upper(trim(_code)), validating only revoked_at, expires_at and use_count.
- `supabase/migrations/20260904235145_7956542c-41b8-41d7-b723-0695d42ea0b4.sql:131` — The INSERT policy does require is_trip_member(trip_id, auth.uid()), showing the intended invariant that UPDATE omits.
- `supabase/migrations/20260905223000_lock_trip_member_insert.sql:1` — Comment 'F-01: stop any signed-in user from self-joining a trip they know the UUID of' - the control this finding bypasses.
- `src/hooks/useTrips.ts:273` — The client already issues .from("trip_invites").update({...}) through PostgREST, so an arbitrary column payload needs no special tooling.

### Preconditions

- **authentication_level** — Any signed-in user with at least one trip of their own, which any account can create.
- **data_state** — The attacker must know the victim trip's UUID. Trip UUIDs are random v4 and are not enumerable through RLS, so this is the limiting precondition. A former member who was removed from a trip retains its UUID, which makes removal unenforceable.

### Reproduction

**Attacker:** A signed-in user who knows a trip UUID they are not a member of - most realistically someone who was previously removed from that trip.

**Payloads**

```
PATCH /rest/v1/trip_invites?id=eq.<own-invite-id>  body: {"trip_id": "<victim-trip-uuid>"}
POST /rest/v1/rpc/accept_trip_invite  body: {"_code": "<own-invite-code>"}
```

**Steps**

1. Sign in as an ordinary user and create a trip you own, so you are a legitimate member of it.
2. Create an invite for that trip through the normal share flow; the row is stored with invited_by = your user id.
3. Issue a PostgREST PATCH against that invite row setting trip_id to the victim trip's UUID. The UPDATE policy admits it because invited_by still equals your user id.
4. Call the accept_trip_invite RPC with your own unchanged invite code.
5. Read the victim trip: its itinerary_items, trip_stops, trip_budget_items and trip_todos are now visible and writable, since each of those policies authorizes via is_trip_member.

**Result:** Not executed against any database. The result above is derived from the policy and function source; see the needs-validation note for the one-command local confirmation.

### Fix

Constrain the edit rather than the editor. Require membership of the post-update trip in WITH CHECK, and stop trip_id being reassignable at all. The narrowest effective change is to make the WITH CHECK a conjunction that always tests the new trip_id, and to add a trigger that rejects any UPDATE changing trip_id. Restricting the grant to the columns a revoke actually needs (GRANT UPDATE (revoked_at, expires_at, max_uses) ) is a worthwhile second layer. Add a regression test that a member of trip A cannot repoint an invite at trip B.

`supabase/migrations/<new>_fix_invite_update_scope.sql`

```
DROP POLICY IF EXISTS "Members revoke invites" ON public.trip_invites;
CREATE POLICY "Members revoke invites"
  ON public.trip_invites
  FOR UPDATE
  TO authenticated
  USING (
    public.is_trip_member(trip_id, auth.uid())
    OR invited_by = auth.uid()
  )
  -- The new row must always belong to a trip the caller is in.
  WITH CHECK (
    public.is_trip_member(trip_id, auth.uid())
  );

-- trip_id is not something an update ever needs to change.
CREATE OR REPLACE FUNCTION public.trip_invites_freeze_trip()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'trip_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trip_invites_freeze_trip ON public.trip_invites;
CREATE TRIGGER trip_invites_freeze_trip
  BEFORE UPDATE ON public.trip_invites
  FOR EACH ROW EXECUTE FUNCTION public.trip_invites_freeze_trip();

```

### Severity reasoning

- **Likelihood (medium):** The edit itself needs only an ordinary authenticated PostgREST call and no timing or race. What bounds it is knowledge of the victim trip UUID, which is not enumerable - but a removed member already holds one, and that is a normal occurrence in a shared-trip app.
- **Impact (high):** The attacker gains the editor role on a trip they have no claim to, with read and write access to its itinerary, stops, budget items and todos, and joins its gated presence channel. Removal from a trip becomes unenforceable.
- **Confidence (high):** Every step is decided by source read directly: the table-wide grant, the disjunctive WITH CHECK, the absence of any trigger or column grant on trip_invites across all migrations, and the definer function keying only on code. An independent reviewer re-derived the same path and found no blocking constraint.

---

## F-2 — SSRF guard on pasted links can be bypassed with IPv6-mapped literals and with DNS names that resolve to private addresses
- **Fingerprint:** `ssrf/place-url/hostname-string-guard-bypass`
- **Severity:** medium (likelihood medium, impact medium)
- **Confidence:** high

### What it is

parsePlaceLink and parseRecoList let an authenticated user hand the server an arbitrary https URL to fetch. The only defence is isPublicHttpsUrl, which inspects the hostname as a string. Two gaps: (1) the IPv4-mapped IPv6 branch matches on dotted-quad form, but the WHATWG URL parser canonicalizes [::ffff:127.0.0.1] to [::ffff:7f00:1], so that branch is unreachable and the loopback literal is admitted - as are [::ffff:a9fe:a9fe] (169.254.169.254) and the unspecified address [::]; (2) nothing ever resolves the hostname, so any public DNS name pointing at a loopback or RFC1918 address passes, as does a rebind between check and connect. The redirect re-check at each hop uses the same string-only predicate, so an attacker-controlled public host can simply 302 to one of these. The build targets a Node host, so loopback and link-local really are reachable from the server process.

### Root cause

The blocklist reasons about hostname spelling rather than about the address actually connected to, and one of its patterns is written against a form the URL parser never emits.

### Intended behavior

A fetch initiated from a user-supplied link must not reach loopback, link-local or private address space. That requires deciding on the resolved address at connect time, not on the hostname string.

### Trace

| Kind | Location | Scope | Note |
|---|---|---|---|
| entrypoint | `src/lib/places.functions.ts:325` | parsePlaceLink server function | Authenticated server function taking a user-supplied url string up to 4000 characters. |
| propagation | `src/lib/place-paste.ts:126` | extractPastedPlaceLink | isLikelyPlaceHost only ranks candidates; best defaults to cleaned[0], so any https host is passed through unfiltered. |
| propagation | `src/lib/place-url.ts:89` | isBlockedHost | Mapped-IPv4 regex requires dotted-quad, which new URL() never produces for an IPv6 literal, so the branch never fires. |
| sink | `src/lib/place-url.ts:184` | fetchHtmlWithPolicy | fetch() to the admitted URL from the Node server process. |

### Evidence

- `src/lib/place-url.ts:92` — /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i - dotted-quad only; Node 22 parses https://[::ffff:127.0.0.1]/ to hostname [::ffff:7f00:1], which cannot match.
- `src/lib/place-url.ts:88` — The IPv6 branch has no case for the unspecified address ::, so https://[::]/ is admitted.
- `src/lib/place-url.ts:110` — isPublicHttpsUrl consults only url.protocol, url.username/password and the hostname string; no address resolution anywhere in the module.
- `src/lib/place-url.ts:211` — The per-hop redirect re-check calls the same string-only canFollow, so a public host may redirect to a blocked-in-intent address.
- `src/lib/place-paste.ts:131` — isLikelyPlaceHost is used to pick best among candidates, never to reject one.
- `vite.config.ts:34` — nitro preset node-server, with the comment 'Canner is a Node host, not Cloudflare' - so the runtime has a real loopback and link-local network.

### Preconditions

- **authentication_level** — Any signed-in user; both entry points carry requireSupabaseAuth.
- **network_routing** — The mapped-IPv6 literals require the deploy host to have an IPv6 stack that routes ::ffff:x to the IPv4 loopback. The DNS-name vector has no such dependency.
- **system_configuration** — Reaching something useful requires a service listening on loopback or the private network of the deploy host. Because the scheme is forced to https, plain-HTTP targets - including the usual cloud metadata endpoint - are not directly reachable.

### Reproduction

**Attacker:** A signed-in user pasting a crafted link into the place or recommendation import field.

**Payloads**

```
https://[::ffff:7f00:1]:8443/
https://[::]:8443/
https://<a-public-name-resolving-to-127.0.0.1>/
```

**Steps**

1. Sign in and open the flow that accepts a pasted place link.
2. Paste one of the payload URLs. extractPastedPlaceLink returns it unchanged because no host filter rejects it.
3. isPublicHttpsUrl admits it: the scheme is https, there are no credentials, and the hostname string matches none of the blocklist branches.
4. The server issues a GET to that address with a 300 KB cap and an 8 second timeout.
5. Read the result: parsePlaceLink returns og:title, twitter:title and the page <title> to the caller, and parseRecoList passes the fetched page text to the model, so the response is partially reflected rather than blind.

**Result:** The guard's verdict was reproduced locally and offline against Node 22's URL parser: [::ffff:127.0.0.1], [::], [::ffff:a9fe:a9fe] and names such as 127.0.0.1.nip.io are all judged public, while the dotted-quad and integer forms of 127.0.0.1 are correctly blocked. Whether a connection then completes was not established here, because the audit container has no IPv6 stack.

### Fix

Stop deciding on the hostname string. Resolve the host, reject any answer in loopback, link-local, unique-local, unspecified, CGNAT or RFC1918 space including IPv4-mapped forms, and pin the connection to the vetted address so the name cannot rebind between check and connect - in Node, by passing a custom lookup to the agent rather than re-resolving. Apply the same check on every redirect hop, which the current code already structures correctly. As an immediate partial fix, normalize an IPv6 hostname before matching and add the unspecified address, but treat that as a stopgap: the DNS vector is the one that string matching cannot close. An egress allowlist or a dedicated fetch proxy is the durable control.

`src/lib/place-url.ts`

```
import { isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";

// Decide on the address, never on the spelling.
function isBlockedAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const octets = ipv4Octets(v4);
  if (octets) return isBlockedIpv4(octets);
  const h = ip.toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

/** Resolve, vet every answer, and return the address to connect to. */
export async function resolvePublicAddress(hostname: string): Promise<string | null> {
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (isIP(bare)) return isBlockedAddress(bare) ? null : bare;
  const answers = await dnsLookup(bare, { all: true, verbatim: true });
  if (!answers.length) return null;
  if (answers.some((a) => isBlockedAddress(a.address))) return null;
  // Pin to the vetted address so the name cannot rebind before connect.
  return answers[0]!.address;
}

```

### Severity reasoning

- **Likelihood (medium):** Trivial to attempt for any signed-in user and needs no race, but landing on something that matters depends on an https service listening on the host's loopback or private network, which source does not show.
- **Impact (medium):** A GET to an internal https endpoint with part of the response reflected back through og:title and the model prompt. The https-only constraint keeps the common plain-HTTP metadata endpoints out of reach, which bounds this well short of credential theft on the evidence available.
- **Confidence (high):** The parser canonicalization was reproduced offline against the exact guard logic, and the absence of any host allowlist or address resolution on the path was confirmed by reading extractPastedPlaceLink and place-url.ts in full, independently twice. Only the downstream blast radius is uncertain, and that is recorded as a needs-validation item rather than claimed.

---

