# Béa authentication baseline

What Béa's sign-in must be set to, where each setting lives, and what was
last seen there. Most of it is configured in the Supabase dashboard
(project `fjfonywfnskriwlhbriw`), not in this repo, so the repo alone cannot
prove any of it. **Nothing below is verified until the record table at the
end says so**, with a date.

Checking is read-only: open each place named, compare, write down what you
see. Change a setting only on purpose, and record the old value too.

## What the code relies on

Sign-in is Supabase Auth: email and password, and Google. The code sends
people back to exactly these addresses, so they are the only redirects that
need allowing:

| Flow | Redirect the code asks for | Where |
| --- | --- | --- |
| Email confirmation | the site origin (`window.location.origin`) | `src/routes/auth.tsx` |
| Google sign-in | the site origin | `src/routes/auth.tsx` |
| Password reset | `<origin>/reset-password` | `src/routes/forgot-password.tsx` |

Server functions take the traveller from the verified JWT
(`requireSupabaseAuth` → `context.userId`), never from the request body. The
service-role key is read only in `*.server.ts` and never prefixed `VITE_`;
CI's `check:public-secrets` fails a build that ships its name to the browser.

## The baseline

### Redirect URLs (Authentication → URL Configuration)

- **Site URL**: Béa's production address on Canner.
- **Redirect URLs**: production origin and `<production>/reset-password`;
  `http://localhost:<port>` and its `/reset-password` only if local sign-in is
  used. Nothing else: no `*` wildcards on production hosts, no old Lovable
  preview addresses (Béa is no longer on Lovable), no temporary hosts.

An allowed redirect is where a sign-in or reset link may send someone with a
fresh session, so an unneeded entry is an open door, not a convenience.

### Password reset (Authentication → Emails / Providers → Email)

- Reset and email-link expiry (OTP expiry): **3,600 seconds or less**.
- "Secure password change" on, if offered: changing the password asks for
  the current session to be recent.

### Email confirmation (Authentication → Providers → Email)

- "Confirm email": **on**. A new email account cannot sign in until it
  follows the link. If this is ever turned off on purpose, write down why.

### Passwords (Authentication → Providers → Email / Policies)

- Minimum length: **8 or more** (Supabase's default is 6).
- Leaked-password protection (HaveIBeenPwned): on where the plan allows it.
  Béa also checks in the app (`pwned-password.ts`), so this is a second
  layer, not the only one.

### Sessions (Authentication → Sessions, and Project Settings → JWT)

- JWT (access token) expiry: **3,600 seconds or less**.
- Refresh token rotation: **on**, with reuse detection on and a short reuse
  interval (Supabase's default 10 s is fine).
- Signing out must end the session on the server, not only in the browser:
  after sign-out, the old refresh token must not mint a new session (see the
  checks below).

### Rate limits (Authentication → Rate Limits)

- Keep Supabase's limits on sign-up, sign-in, OTP and password-reset emails.
  Do not raise them without a reason written here.

### Google (Authentication → Providers → Google)

- Client ID and secret from Béa's own Google Cloud project.
- In Google Cloud, the authorised redirect URI is only Supabase's callback
  (`https://fjfonywfnskriwlhbriw.supabase.co/auth/v1/callback`).

## Checks to run (a test account, never a real traveller's)

Use two throwaway accounts, Alice and Bob, on production or a copy of it.

1. **Sign-out ends the session.** Sign Alice in and note her refresh token
   (browser storage). Sign out. Calling `refreshSession` with that token must
   fail.
2. **Reset links expire and work once.** Request a reset for Alice. The link
   works once; used again, or after the expiry above, it must fail.
3. **Unconfirmed email cannot sign in.** Sign up a new address and try to
   sign in before following the confirmation link: refused.
4. **Redirects are not open.** A reset or OAuth request with `redirectTo` set
   to an address not on the list must land on the Site URL, not that address.
5. **One traveller cannot reach another's data.** With Bob signed in, his
   client cannot select, update or delete Alice's `trips`, `trip_members`,
   `vault_settings`, `vault_documents`, `trip_documents` or her stored files,
   and cannot add himself to her trip. Row level security decides this; the
   migration check in CI only proves every public table has it switched on.
6. **Identity comes from the token.** A server function called by Bob with
   Alice's user ID somewhere in the body still acts as Bob.

## Record

Fill in a row whenever a setting is checked or changed.

| Setting | Required | Seen | Changed from | Checked on | By |
| --- | --- | --- | --- | --- | --- |
| Site URL | production origin | not yet verified | | | |
| Redirect URLs | list above only | not yet verified | | | |
| Reset / OTP expiry | ≤ 3600 s | not yet verified | | | |
| Confirm email | on | not yet verified | | | |
| Minimum password length | ≥ 8 | not yet verified | | | |
| Leaked-password protection | on (if plan allows) | not yet verified | | | |
| JWT expiry | ≤ 3600 s | not yet verified | | | |
| Refresh token rotation + reuse detection | on | not yet verified | | | |
| Auth rate limits | Supabase defaults or lower | not yet verified | | | |
| Google redirect URI | Supabase callback only | not yet verified | | | |

| Check | Result | Run on | By |
| --- | --- | --- | --- |
| 1. Sign-out ends the session | not yet run | | |
| 2. Reset links expire, work once | not yet run | | |
| 3. Unconfirmed email cannot sign in | not yet run | | |
| 4. Redirects are not open | not yet run | | |
| 5. Cross-account access refused | not yet run | | |
| 6. Identity from the token | not yet run | | |
