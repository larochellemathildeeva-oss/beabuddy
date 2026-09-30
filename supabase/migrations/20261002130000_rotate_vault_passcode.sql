-- Changing the Protected passcode in one transaction.
--
-- Protected is encrypted in the browser with a key from the passcode, so a
-- new passcode means every document re-encrypted under a new key, plus a new
-- salt and verifier. Written as separate updates, a failure halfway would
-- leave some documents sealed under a key nobody has any more. So the browser
-- re-encrypts everything, and this function writes it all or nothing.
--
-- SECURITY INVOKER: it runs as the signed-in traveller, under the same row
-- level security as every other write to these tables ("Users manage own
-- …"), and touches only their own rows.
--
-- `_old_verifier` is the verifier the browser unlocked with: if another
-- device changed the passcode meanwhile, nothing is written. `_documents` must
-- name every document the traveller has, each once, so none is left behind
-- under the old key.
--
-- A document added from another device while a change runs would be sealed
-- under the old key. So every insert first takes a share lock on the
-- traveller's vault_settings row (vault_documents_wait_for_rotation): an
-- insert that comes first makes the change wait and then refuse (one
-- document too many); one that comes second waits for the change to commit,
-- and the browser that added it sees the new verifier, deletes its row and
-- asks to unlock again (useVault's addDoc).
--
-- Applied by hand; safe to re-run. Until it is applied, changing the passcode
-- fails with nothing changed, and the old passcode keeps working.

CREATE OR REPLACE FUNCTION public.rotate_vault_passcode(
  _old_verifier text,
  _salt text,
  _verifier text,
  _verifier_iv text,
  _documents jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _have integer;
  _given integer;
  _updated integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501';
  END IF;
  IF coalesce(_salt, '') = '' OR coalesce(_verifier, '') = '' OR coalesce(_verifier_iv, '') = ''
     OR _documents IS NULL OR jsonb_typeof(_documents) <> 'array' THEN
    RAISE EXCEPTION 'rotate_vault_passcode: salt, verifier and a list of documents are required'
      USING ERRCODE = '22023';
  END IF;

  -- The vault as it was unlocked, held until this transaction ends.
  PERFORM 1 FROM public.vault_settings
  WHERE user_id = _uid AND verifier = _old_verifier
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Protected changed on another device; unlock again' USING ERRCODE = '40001';
  END IF;

  PERFORM 1 FROM public.vault_documents WHERE user_id = _uid FOR UPDATE;
  SELECT count(*) INTO _have FROM public.vault_documents WHERE user_id = _uid;
  SELECT count(*), count(DISTINCT d->>'id') INTO _given, _updated
  FROM jsonb_array_elements(_documents) d;
  IF _given <> _have OR _updated <> _have THEN
    RAISE EXCEPTION 'Protected changed on another device; unlock again' USING ERRCODE = '40001';
  END IF;

  UPDATE public.vault_documents v
  SET ciphertext = d->>'ciphertext', iv = d->>'iv'
  FROM jsonb_array_elements(_documents) d
  WHERE v.user_id = _uid
    AND v.id = (d->>'id')::uuid
    AND coalesce(d->>'ciphertext', '') <> ''
    AND coalesce(d->>'iv', '') <> '';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  IF _updated <> _have THEN
    RAISE EXCEPTION 'Protected changed on another device; unlock again' USING ERRCODE = '40001';
  END IF;

  UPDATE public.vault_settings
  SET salt = _salt, verifier = _verifier, verifier_iv = _verifier_iv
  WHERE user_id = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_vault_passcode(text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_vault_passcode(text, text, text, text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.vault_documents_wait_for_rotation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM public.vault_settings WHERE user_id = NEW.user_id FOR SHARE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vault_documents_wait_for_rotation ON public.vault_documents;
CREATE TRIGGER vault_documents_wait_for_rotation
  BEFORE INSERT ON public.vault_documents
  FOR EACH ROW EXECUTE FUNCTION public.vault_documents_wait_for_rotation();
