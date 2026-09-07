# Béa verified security backlog

Deduped from the pass-2 checklist + meta-audit (2026-09-07).
**Use this for work.** The 84-row canvases are reference only.

Status key: `Open` · `In repo` · `Verified` · `Accepted` · `Watch`

Safe-negation rule: UX mitigations must not weaken the control. Anything that
reduces crypto strength, invite single-use, or verification belongs under
**Explicit accept** with date + revisit trigger — never as a default tip.

---

## Unique backlog (10)

| # | Issue | Pri | Status | Effort | Residual after fix | Next step |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Live account-delete proof + failure modes | P0 | In repo | S | Low if verified | Run pack A on Canner canary |
| 2 | Supabase Auth dashboard unknowns | P0 | Open | S | Med until known | Pack B settings pass/fail |
| 3 | Authz re-test after delete deploy | P0 | In repo* | S | Low if verified | Pack C A/B IDOR on Canner |
| 4 | Remove / leave trip UI | P1 | In repo | M | Low | Smoke on deploy; trip settings → Invite |
| 5 | Analytics inventory vs Privacy | P1 | Open | M | Med | List app + Canner events |
| 6 | Gemini retention decision | P1 | Open | S | Med if accepted | Decide + date below |
| 7 | App-level AI / geocode quotas | P1 | Partial | M | Med | Per-user throttle beyond provider 429 |
| 8 | Invite guessability documented | P1 | Done (math) | S | Low | See § Invite math; throttle OK |
| 9 | Legacy photo / receipt EXIF | P2 | Open | M | Med | Lazy re-strip or disclose cohort |
| 10 | Outside-checklist threats | P2 | Watch | S | — | § Outside checklist |

\*Controls in RLS/RPC; production re-test still required.

---

## Decision log (explicit accepts)

| Decision | Choice | Date | Owner | Revisit when |
| --- | --- | --- | --- | --- |
| Upload malware AV | **Accepted** — type/size only | 2026-09-06 | Founder | Public/share links ship |
| Gemini zero-retention | **Pending** | — | Founder | Before pilots / paid AI |
| Soft vs hard email verify | **Pending** (Auth dashboard) | — | Founder | Pack B complete |
| Invite multi-use | **Rejected** — keep `max_uses: 1` | 2026-09-07 | Founder | Only with written accept |
| Passcode recovery hints | **Rejected** — no server recovery | 2026-09-07 | Founder | Never without threat-model change |
| `trip_invite_attempts` RLS, no policies | **Accepted** — DEFINER-only writes | 2026-09-07 | Founder | If client needs to read attempts |
| Leaked-password (HIBP) protection | **Accepted free path** — Supabase Pro toggle off; app uses HIBP range API on sign-up + reset (`src/lib/pwned-password.ts`) | 2026-09-07 | Founder | Revisit if moving to Supabase Pro |

---

## Invite guessability (item 8)

Alphabet: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` → **32** chars.  
Length: **10**. Space: \(32^{10} = 2^{50}\) ≈ **1.126 × 10¹⁵** codes.

Throttle (live RPC): **20 attempts / 10 minutes / authenticated user**.

| Attacker model | Attempts | Expected time to hit one random live code* |
| --- | --- | --- |
| Single account | 20 / 10 min → 120/h | Astronomical (space ≫ attempts) |
| 100 sockpuppet accounts | ~12k/h | Still negligible vs \(2^{50}\) |
| Online guessing one *known-short* code | N/A — codes are 10-char CSPRNG | Not applicable |

\*Assumes ≤ few dozen *active* invites globally; collision with a live code is
what matters, not enumerating the space. Residual risk is **social** (shared
code screenshot) and **multi-account** fill of the user_id throttle — not
brute force of 10-char codes. Optional harden: per-IP or per-code fail counters.

Source: `src/lib/trip-invite.ts`, `accept_trip_invite` in
`supabase/migrations/20260907010000_harden_trip_invites.sql`.  
Unit check: `src/lib/invite-guessability.test.ts`.

---

## Verification packs

### Pack A — Account delete (Canner)

Prereq: `SUPABASE_SERVICE_ROLE_KEY` set on Canner; dedicated **canary** account
(not a real user).

1. Sign in as canary; add 1 photo + 1 receipt (or confirm empty).
2. Profile → Legal → type `DELETE`.
3. Confirm cannot sign in with same credentials.
4. Supabase: Auth user gone; `photo-memories/{userId}` and `receipts/{userId}` empty.
5. If canary was on a shared trip: other member still opens trip; canary gone from members.
6. Record: date, env URL, pass/fail. On fail: do not claim delete in marketing.

Failure modes to watch: Storage purged but Auth remains (user can re-login empty);
Auth deleted but Storage orphans (use list-prefix purge — already in code).

### Pack B — Auth dashboard

In Supabase project `fjfonywfnskriwlhbriw` → Authentication → Settings / Providers:

| Setting | Pass if | Actual | Date |
| --- | --- | --- | --- |
| Password reset / recovery link expiry | ≤ 1 hour preferred | | |
| Email confirmation | Policy chosen + documented | | |
| JWT expiry | Known; refresh works | | |
| Logout / session revoke | Refresh invalid after logout | | |
| Leaked password protection (HIBP) | Pro toggle **or** free app check | Free: HIBP range API on sign-up/reset (`pwned-password.ts`). Pro toggle optional. | 2026-09-07 |
| Google OAuth | Redirect URLs include Canner + local | | |

### Pack C — Authz IDOR (two accounts A and B)

On production/Canner after delete deploy:

1. A creates trip; note trip UUID. B must **not** open `/trips` data for that id via API.
2. B calls `accept_trip_invite` with garbage codes → rate limit after 20/10min.
3. B must not `INSERT` into `trip_members` (revoked).
4. A photo: B must not fetch Storage object without signed URL; expired sign fails.
5. A vault row: B SELECT returns empty.
6. A expense: B denied.
7. After A deletes account: B’s membership on shared trip intact; A’s private rows gone.

---

## Outside-checklist threats (item 10)

| Threat | Status | Note |
| --- | --- | --- |
| XSS / extension → vault passcode or session | Watch | CSP / dependency hygiene; unlock session in memory only |
| `service_role` leak on Canner | Watch | Server-only; rotate if logs expose |
| Dependency / supply chain | Watch | Lockfile + CI; no blind major bumps |
| Unlocked device, vault session open | Watch | Passcode; Help: logout on shared devices |
| Gemini prompt injection via import text | Watch | Import warnings; no vault/photos in prompts |
| Shoulder surf / screenshots of unlock | Watch | Product accept |
| Canner/host compromise | Watch | Vendor trust; minimize secrets |
| Realtime presence spoof (name) | Watch | Presence is client-supplied; private channel gated |

---

## Advisor notes (live 2026-09-07)

- `trip_invite_attempts` RLS, no policies — **intentional** (DEFINER-only).
- `accept_trip_invite` / `is_trip_member` SECURITY DEFINER executable by
  authenticated — **intentional** join/helper path; do not revoke EXECUTE.
- Auth leaked-password protection **disabled** (Pro) — **mitigated in-app** via
  HIBP k-anonymity range check on sign-up and password reset.

---

## Pass log

| Date | Action |
| --- | --- |
| 2026-09-07 | Backlog created; invite math; leave/remove UI; Safe-negation + decision log |
| 2026-09-07 | Free HIBP range check on sign-up/reset; idle auto-logout (45 min) |
