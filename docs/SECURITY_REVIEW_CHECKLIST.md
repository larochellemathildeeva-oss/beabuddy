# Béa Security Review Checklist

Founder security review — not an enterprise SOC 2 audit. Goal: catch dangerous
assumptions before launch and before privacy/security copy overpromises.

Pair with `docs/WHAT_BEA_BELIEVES.md`, `docs/BRANDING.md`, Help FAQ, and Privacy Policy.
Voice/FAQ rule: prefer *designed to / private by default / may* over *always / never / only / impossible*.

**Pass 2 — 2026-09-06 (evening).** Grounded in `main` through account-deletion commit `a5b53ce`
(v3.6.0 locally; confirm deploy). Invite migration `harden_trip_invites` applied to live
Supabase. Dashboard: Cursor canvas `bea-risk-matrix.canvas.tsx`.

**Pass 3 — 2026-09-07.** Deduped work lives in `docs/SECURITY_VERIFIED_BACKLOG.md` (10 unique
items, verification packs A–C, invite math, decision log, outside-checklist threats). Leave /
remove-member UI shipping. Advisor: enable Auth leaked-password protection.

---

## 1. Data inventory

Do we know what we collect?

| Item | Why | Where | If we stop |
| --- | --- | --- | --- |
| Account email | Auth | Supabase Auth | Cannot sign in |
| Display name / home city | Profile, trips, globe | `profiles` | Cosmetic / empty home |
| Travel preferences | Let Béa plan / compare | `profiles.preferences` | Generic plans |
| Recommendations | Memory layer | `recommendations` | Core product empty |
| Trips / itinerary | Planning | `trips`, members, items | Core product empty |
| Notes (Future Me) | Memory | `future_notes` | No later-you notes |
| Photos | Memories / story | `photo_memories` + bucket `photo-memories` | No city albums |
| EXIF / GPS from photos | Place on map | DB `lat`/`lon`; file GPS designed stripped on keep-photo | Map pins weaker |
| Near GPS | Distance ranking | **In-memory only**; consent expiry in localStorage | Near still works via demo city |
| Vault documents | Trip tickets/confirmations | `vault_documents` ciphertext; labels plaintext | No trip docs |
| Receipts / expenses | Work travel | `expenses` + bucket `receipts` | No expense export |
| AI prompts / answers | Plan, import, compare, OCR | Sent to Google Gemini; Béa stores what user saves | Features fail closed |
| Analytics | Unknown | Inventory still open | — |
| Feedback | Product | `app_reports` | Support blind |

- [x] Inventory listed (this table)
- [ ] Analytics events inventoried vs policy
- [ ] Backup / log retention windows known (Supabase + Canner + Gemini)

---

## 2. Authentication & accounts

Supabase Auth (email + Google). Not a dashboard audit.

- [x] Passwords hashed by Supabase (not our code)
- [ ] Password reset token expiry confirmed in project settings
- [ ] Email verification policy confirmed
- [ ] Session expiration / logout invalidation confirmed
- [x] Google OAuth used; code-exchange race was fixed earlier (`a220d2d` era)
- [ ] Account linking / duplicate-account matrix tested this pass
- [x] In-app account delete exists (Profile → Legal; type `DELETE`)
- [ ] Live delete smoke-tested on Canner (`SUPABASE_SERVICE_ROLE_KEY` must be set)

**Red-team leftover:** dashboard auth settings still **Unknown**.

---

## 3. Authorization

Users access only their own data for:

- [x] Recommendations (RLS)
- [x] Trips (RLS; join only via `accept_trip_invite`)
- [x] Notes
- [x] Photos (signed URLs, 1h)
- [x] Vault documents (RLS + ciphertext)
- [x] Expenses
- [x] Feedback

Verify:

- [x] Trip UUID IDOR blocked (`lock_trip_member_insert` + RPC-only member insert)
- [ ] Fresh ID-guessing pass after delete-account deploy
- [x] Invite codes: 10-char alphabet, 7-day expiry, single-use, revoke, accept rate limit
- [x] Remove-member / leave-trip UI (trip settings → Invite; owner remove + guest leave)

**Red-team:** User A opening user B's trip by URL — mitigated last pass; re-test after delete ships.

---

## 4. Document Vault (trip documents)

Positioning: reservations, tickets, confirmations, boarding passes — **not** passports / ID.

- [x] Encryption: AES-256-GCM, PBKDF2 210k, key from passcode, ciphertext on server
- [x] Unlock is **passcode-only** (Face ID / localStorage key removed)
- [x] Derived keys non-extractable; leftover biometric keys cleared on vault load
- [x] Copy: passcode-only; labels/kind/expiry readable while locked
- [ ] Formal threat model doc (this checklist is the standing note)

Residual: plaintext `kind` / `label` / `expires_on`. Not ID documents by product intent.

---

## 5. Location data

- [x] Near requests GPS only after consent; expiry in localStorage, not coordinates
- [x] Stop sharing clears live position
- [x] Privacy: no location history from Near
- [x] Saved pins / photo `lat`/`lon` **do** persist (user-chosen or EXIF-derived)

---

## 6. Photos & EXIF

- [x] Import consent UI exists
- [x] Keep-photo path re-encodes JPEG to drop file GPS; `lat`/`lon` still stored on the row for the map
- [x] Locations-only mode does not upload the file
- [x] Delete removes storage object + row
- [ ] Existing blobs uploaded *before* strip not backfilled
- [ ] Receipt images not stripped (expenses, not vault)

---

## 7. AI features

- [x] Help: suggestions not decisions; uncertainty copy
- [x] Privacy/Help: Gemini may retain per Google policy; photo memories not sent; vault secrets not in prompts
- [ ] No coded Gemini zero-retention / no-train flag in `ai.server.ts`
- [x] Import surfaces warn against passport / card numbers

---

## 8. File upload security

Photos · receipts · documents (as vault ciphertext) · CSV · itinerary images

- [ ] Max file size enforced consistently
- [ ] File-type allowlist reviewed
- [x] Malware scanning: **accepted early** (P2)
- [ ] Upload rate limits (AI cost more urgent than malware)

---

## 9. API review

ServerFns use `requireSupabaseAuth` where gated. Invite accept rate-limited in SQL.

- [x] Auth on member serverFns
- [x] Trip join authorization server-side (DEFINER RPC)
- [ ] Broader rate limits (AI, geocode)
- [ ] Parameter-tampering re-test after 3.6.0

---

## 10. Privacy copy review

Pass 2: vault Face ID caveat **removed**; account close now points at Profile → Legal;
invite expiry described; AI provider *may* retain.

Keep scanning Help/privacy for *always / never / only / impossible*.

- [x] Vault copy matches passcode-only + metadata honesty
- [x] Account delete copy matches in-app control (*designed to*)
- [x] Near / photos / AI disclosures improved
- [ ] Full Help + marketing sweep this week

---

## 11. Data retention

| Data | Retained how long? |
| --- | --- |
| Trips, recs, notes, vault rows | Until user deletes item or account |
| Photos / receipts files | Until item or account delete (purge then Auth delete) |
| Near GPS | Not stored |
| Photo map coords | Until photo/account delete |
| AI prompts | Provider policy (not coded) |
| Logs / backups | **Unknown** — disclose *may lag* |
| Analytics | **Unknown** |

- [x] Account deletion behavior documented (code + Privacy/Help)
- [ ] Backup retention known
- [ ] Live delete verified (storage empty + cannot sign in)

---

## 12. Incident readiness

- [ ] One-page runbook: what happened · who · what data · how notify · owner

---

## 13. Founder reality check

| Question | This pass |
| --- | --- |
| Where data lives | **Mostly** — Auth, Postgres, two buckets, Gemini, localStorage (tour/consent). Analytics unknown |
| Who can access | **Mostly** — RLS + service role on server. Dashboard roles not reviewed |
| How protected | **Mostly** — vault ciphertext real; metadata not |
| How deleted | **Code yes / live test no** |
| Privacy copy = reality | **Much closer** — keep sweeping |
| Security marketing = reality | **Improved** — no Face ID encryption claims |

---

## Priority focus (remaining)

See **`docs/SECURITY_VERIFIED_BACKLOG.md`** for the deduped 10-row backlog and packs A–C.

1. Live account-delete smoke test + Canner service role (Pack A)  
2. Supabase Auth dashboard incl. HIBP (Pack B) — Pro toggle optional; free in-app check shipped  
3. Authz IDOR re-test on Canner (Pack C)  
4. Analytics inventory  
5. AI zero-retention or accept provider terms as-is  
6. Pre-strip photo blobs (optional backfill)

Leave / remove-member: **in app** (trip settings → Invite). Confirm on deploy.

---

## Risk matrix (severity × launch urgency)

Severity = user impact if exploited. Priority = how urgently to fix before launch.

| Priority | Meaning | Test question |
| --- | --- | --- |
| **P0** | Launch blocker | Would I be comfortable explaining this to every affected user? If no → P0. |
| **P1** | Before growth / pilots | Could a journalist write an embarrassing article? If yes → P1. |
| **P2** | Schedule | Important, not immediately dangerous. |
| **P3** | Nice to have | Polish and maturity. |

### Tracked risks (reassessed 2026-09-06 evening)

| Risk | Sev | Likely | Pri | Status |
| --- | --- | --- | --- | --- |
| Vault claims ≠ implementation | High | Low | P1 | Mitigated |
| Cross-user authz (trips/docs) | Critical | Low | P0 | Mitigated* |
| Shared-trip invite abuse | High | Low | P1 | Mitigated |
| No remove-member UI | Med | Med | P1 | Shipping* |
| Location retained unexpectedly | Med | Low | P2 | Clarify |
| Account deletion incomplete | High | Low | P0 | Code done* |
| Docs/files by URL guessing | Critical | Low | P1 | Likely OK |
| Password reset / session weakness | Critical | Low | P0 | Unknown (+ HIBP off) |
| Privacy copy overpromises | High | Med | P1 | Improving |
| AI prompts / provider retention | High | Med | P1 | Disclosed |
| Photo EXIF in **new** uploads | Med | Low | P2 | Mitigated |
| Photo EXIF in **old** blobs | Med | Med | P2 | Open |
| Analytics beyond disclosure | Med | Med | P1 | Unknown |
| Near tracking confusion | Med | Med | P2 | Watch |
| No rate limiting (AI / other) | Med | Med | P1 | Partial |
| OCR / vault-scan mismatch | Med | Low | P2 | Watch |
| AI treated as facts | Med | Med | P2 | Improving |
| Excess log retention | Med | Med | P2 | Unknown |
| Upload malware protections | Med | Low | P2 | Accepted early |
| Offline data on shared devices | Med | Low | P2 | Watch |
| Bug reports with personal data | Med | Low | P3 | Watch |

\*Mitigated = controls in repo/RLS. Account delete: **untested on production**. Authz: re-test after deploy.

Live dashboard: Cursor canvas `bea-risk-matrix.canvas.tsx`.

### Founder dashboard (six categories)

| Category | Current risk | Why |
| --- | --- | --- |
| Authentication | Unknown | Dashboard settings not reviewed this pass |
| Authorization | Medium | IDOR + invites hardened; member-remove still missing |
| Vault | Medium | Real crypto, passcode-only; metadata plaintext |
| Privacy | Medium | Copy catching up; analytics/backups unknown |
| AI | Medium | Disclosed Gemini; no zero-retention config |
| Deletion & retention | Medium | In-app delete coded; live proof + backups open |

### Launch gates

**Security:** auth dashboard **open** · authorization **improved** · invites **shipped** · vault **passcode-only** · uploads **partial**

**Privacy:** policy/FAQ **much closer** · location **documented** · photo strip **new uploads** · AI **disclosed**

**Trust:** Face ID encryption claims **gone** · keep *designed to / may*

### Top 5 now

1. Smoke-test account deletion on deployed Béa (Pack A)  
2. Review Supabase Auth project settings + enable HIBP (Pack B)  
3. Authz IDOR re-test on Canner (Pack C)  
4. Inventory analytics vs Privacy  
5. Decide: accept Gemini retention or pay for zero-retention  

Leave/remove-member is in the app (trip settings). See `docs/SECURITY_VERIFIED_BACKLOG.md`.

### Pass log

| Date | Focus | Outcome |
| --- | --- | --- |
| 2026-09-06 | Six-priority founder pass | Vault partial, invites weak, EXIF in files, no account delete |
| 2026-09-06 | Risk matrix + launch gates | See first `bea-risk-matrix` |
| 2026-09-06 evening | Pass 2 after vault/invites/EXIF/delete | This file + updated `bea-risk-matrix` |
| 2026-09-07 | Deduped backlog + leave/remove + invite math | `SECURITY_VERIFIED_BACKLOG.md` |
