# Login — function checklist

Every function the sign-in page (`/auth`) had before the master rebuild. The
redesign keeps all of them. Source: `src/routes/auth.tsx`,
`PasswordCreationRules.tsx`, `CopyrightNotice.tsx`.

## Page
- [x] Signed-in visitor is sent to Home
- [x] Title "Welcome back" (sign in) / "Start your vault" (sign up), with the saved-to-your-account line
- [x] Copyright notice at the foot

## Google
- [x] "Continue with Google" (Supabase OAuth, redirect to origin), disabled while busy
- [x] "Sign me in automatically" / "Ask me every time" — stored in localStorage `bea-google-signin`; "ask" adds `prompt=select_account`
- [x] Error "That sign-in didn't complete. Please try again."
- [x] "By continuing you agree to our Terms of Service and Privacy Policy." with links

## Email
- [x] Sign up only: "Your name"
- [x] Email (required, type email)
- [x] Password (required; min length 6 sign in, MIN_NEW_PASSWORD_LENGTH sign up; autocomplete current/new)
- [x] Sign up only: PasswordCreationRules under the password
- [x] Sign up only: two consent checkboxes (16+ and Terms/Privacy; personal-organiser disclaimer); create disabled until both
- [x] Sign up: pwned-password check, signUp with display_name, legal_consents insert when a session comes back, "Check your email…" message
- [x] Sign in: signInWithPassword
- [x] Error and message lines
- [x] Submit "Sign in" / "Agree & create account", disabled while busy

## Links
- [x] "Forgot your password?" → /forgot-password (sign in only)
- [x] "Create a new account" / "I already have an account" switches mode and clears messages
