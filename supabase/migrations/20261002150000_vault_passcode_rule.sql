-- Which passcode rule a Protected vault's passcode is known to meet.
--
-- New passcodes need 12 characters (validateVaultPasscode). Older vaults still
-- unlock, and are asked for a stronger passcode when it is typed and found
-- short. A Face ID / fingerprint unlock never sees the passcode, so it reads
-- this instead: null (set before the rule was recorded) or below today's rule
-- (VAULT_PASSCODE_RULE, 2) means "ask". The app writes 2 when a passcode is
-- created or changed, or typed and found to meet the rule. It says nothing
-- else about the passcode.
--
-- The column falls under the table's existing grants and row level security
-- ("Users manage own vault settings"): a traveller reads and writes only
-- their own row. Setting it falsely only hides their own prompt.
--
-- Applied by hand; safe to re-run. Until it is applied the app cannot read
-- it and simply does not prompt after a Face ID unlock; a typed short
-- passcode is still prompted.

ALTER TABLE public.vault_settings ADD COLUMN IF NOT EXISTS passcode_rule smallint;
