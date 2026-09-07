# Béa Security Review Checklist

Founder security review — not an enterprise SOC 2 audit. Goal: catch dangerous
assumptions before launch and before privacy/security copy overpromises.

Pair with `docs/WHAT_BEA_BELIEVES.md`, `docs/BRANDING.md`, Help FAQ, and Privacy Policy.
Voice/FAQ rule: prefer *designed to / private by default / may* over *always / never / only / impossible*.

## 1. Data inventory

Do we know what we collect?

- [ ] Account email
- [ ] Display name
- [ ] Home city
- [ ] Travel preferences
- [ ] Recommendations
- [ ] Trips
- [ ] Notes
- [ ] Photos
- [ ] EXIF location data
- [ ] GPS location
- [ ] Documents (Vault)
- [ ] Receipt images
- [ ] Expense information
- [ ] AI prompts and responses
- [ ] Analytics events

For each item: why collect it · which feature needs it · what if we stop.

## 2. Authentication & accounts

- [ ] Passwords hashed with modern algorithms (Supabase Auth)
- [ ] Password reset tokens expire
- [ ] Email verification where appropriate
- [ ] Session expiration defined
- [ ] Logout invalidates session
- [ ] Google OAuth flow reviewed
- [ ] Account linking tested
- [ ] Duplicate-account scenarios tested
- [ ] OAuth tokens stored safely
- [ ] OAuth revocation behavior understood

## 3. Authorization

Users access only their own data for:

- [ ] Recommendations
- [ ] Trips
- [ ] Notes
- [ ] Photos
- [ ] Documents
- [ ] Expenses
- [ ] Feedback

Verify:

- [ ] No access by changing a URL / ID
- [ ] No access via API with another user's IDs
- [ ] Shared-trip permissions correct

**Red-team:** Can user A open user B's trip by editing `/trips` or an ID? If yes → critical.

## 4. Document Vault (trip documents)

Positioning: reservations, tickets, confirmations, boarding passes — **not** passports / ID.
Most sensitive encrypted feature remaining.

- [ ] Encryption design documented
- [ ] Encryption claims match reality
- [ ] Key management documented
- [ ] Vault threat model written

Questions: client-side vs server-side · who has keys · admin/support access ·

Copy: do not claim *only you / impossible / zero knowledge* unless verified.

## 5. Location data

- [ ] Requested only when needed
- [ ] Permission prompts clear
- [ ] Access can be revoked
- [ ] Not collected unnecessarily
- [ ] Retention known (stored? how long? who access?)
- [ ] Near respects consent expiry
- [ ] Stop-sharing actually stops

## 6. Photos & EXIF

- [ ] Users understand what is imported
- [ ] EXIF handling documented
- [ ] Remove photo removes photo
- [ ] GPS metadata: retained / stripped?
- [ ] Thumbnails / backup retention after delete

## 7. AI features

- [ ] Outputs not represented as facts
- [ ] Confidence / uncertainty messaging exists
- [ ] Help me choose / Let Béa plan / extraction / import reviewed
- [ ] What enters prompts known
- [ ] Retention / training posture documented

## 8. File upload security

Photos · receipts · documents · CSV · itinerary images

- [ ] Max file size
- [ ] File-type restrictions
- [ ] Malware scanning (or accepted risk)
- [ ] Filename sanitization
- [ ] Upload rate limits

## 9. API review

For each endpoint:

- [ ] Auth where appropriate
- [ ] Authorization server-side
- [ ] Input validation
- [ ] Rate limiting

Tests: ID guessing · parameter tampering · missing permissions · excess requests

## 10. Privacy copy review

For every FAQ / marketing claim: **Can we prove this?**

Safe: private by default · designed to protect · you can remove content  
Risky: nobody can see · we never access · completely secure · impossible to recover

## 11. Data retention

| Data | Retained how long? |
| --- | --- |
| Trips | ? |
| Recommendations | ? |
| Photos | ? |
| Vault docs | ? |
| Receipts | ? |
| Logs | ? |
| Analytics | ? |

- [ ] Account deletion behavior documented
- [ ] Backup retention known
- [ ] Deleted-content retention periods known

## 12. Incident readiness

Can we answer: what happened · who affected · what data · how notify · who owns response?

Even a one-page runbook is enough initially.

## 13. Founder reality check

Before launch, can you honestly say:

- [ ] I know where every piece of user data lives
- [ ] I know who can access it
- [ ] I know how it's protected
- [ ] I know how it's deleted
- [ ] Privacy copy matches reality
- [ ] Security marketing matches reality

If any answer is “not sure,” that is the next review.

## Priority focus (highest risk first)

1. Document Vault encryption claims  
2. Shared-trip authorization  
3. Photo and EXIF handling  
4. Location storage and retention  
5. AI prompt / privacy disclosures  
6. Account deletion and data retention  

## Risk matrix (severity × launch urgency)

Severity = user impact if exploited. Priority = how urgently to fix before launch.
Not every High severity is P0; not every P0 is catastrophic (e.g. privacy confusion can be P0 for trust).

| Priority | Meaning | Test question |
| --- | --- | --- |
| **P0** | Launch blocker | Would I be comfortable explaining this to every affected user? If no → P0. |
| **P1** | Before growth / pilots | Could a journalist write an embarrassing article? If yes → P1. |
| **P2** | Schedule | Important, not immediately dangerous. |
| **P3** | Nice to have | Polish and maturity. |

### Tracked risks (assessed 2026-09-06)

| Risk | Sev | Likely | Pri | Status |
| --- | --- | --- | --- | --- |
| Vault claims ≠ implementation | Critical | Med | P0 | Watch |
| Cross-user authz (trips/docs) | Critical | Med | P0 | Mitigated* (re-test) |
| Shared-trip permission bugs | High | Med | P0 | Open |
| Location retained unexpectedly | High | Med | P0 | Clarify |
| Account deletion incomplete | High | Med | P0 | Open |
| Docs accessible by URL guessing | Critical | Low | P0 | Likely OK — re-verify |
| Password reset / session weakness | Critical | Low | P0 | Unknown |
| Privacy copy overpromises | High | High | P0 | Improving |
| AI prompts unexpected sensitive content | High | Med | P1 | Open |
| Photo EXIF unintentionally exposed | High | Med | P1 | Open |
| Analytics beyond disclosure | Med | Med | P1 | Unknown |
| Near tracking confusion | Med | High | P1 | Watch |
| No rate limiting | Med | Med | P1 | Open |
| OCR / scan expectation mismatch | Med | Med | P1 | Watch |
| AI treated as facts | Med | Med | P2 | Improving |
| Excess log retention | Med | Med | P2 | Unknown |
| Upload malware protections | Med | Low | P2 | Accepted early |
| Offline data on shared devices | Med | Low | P2 | Open |
| Bug reports with personal data | Med | Low | P3 | Watch |

Live dashboard: Cursor canvas `bea-risk-matrix.canvas.tsx`.

### Founder dashboard (six categories)

| Category | Current risk | Key questions |
| --- | --- | --- |
| Authentication | Unknown | Takeover? Session hijack? |
| Authorization | Highest | Cross-user access? Shared trips? |
| Vault | Highest | What encrypted? Keys? Honest claims? |
| Privacy | Highest | FAQ = reality? Location/photos understood? |
| AI | Medium | Prompt contents? Disclosures? |
| Deletion & retention | Medium | After delete? Backups? Account close? |

### Launch gates (green before “ready”)

**Security:** auth reviewed · authorization tested · shared-trip permissions tested · document storage reviewed · file uploads reviewed  

**Privacy:** policy matches code · FAQ matches code · location retention documented · photo handling documented · AI usage disclosed  

**Trust:** no unproven zero-knowledge / nobody-can-access / completely secure / always-never claims  

### Top 5 to investigate first

1. Vault architecture and encryption claims  
2. Cross-user authorization and shared trips  
3. Location storage and retention  
4. Photo/EXIF handling  
5. Privacy-copy vs implementation consistency  

### Pass log

| Date | Focus | Outcome |
| --- | --- | --- |
| 2026-09-06 | Six-priority founder pass | See `bea-security-founder-pass` canvas |
| 2026-09-06 | Risk matrix + launch gates | See `bea-risk-matrix` canvas |
