-- Atomic itinerary schedule changes with optimistic-concurrency checks.
--
-- Applied by hand in the Supabase SQL editor; writing this file does not
-- change the live database. The app may keep its existing row-by-row fallback
-- until this function is present, but Review/Undo can only promise atomic
-- ChangeSets once this migration has been applied.

CREATE OR REPLACE FUNCTION public.apply_itinerary_schedule(
  _trip_id uuid,
  _updates jsonb,
  _expected_versions jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_update jsonb;
  v_id uuid;
  v_expected timestamptz;
  v_current timestamptz;
  v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to edit a trip';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.trip_members m
    WHERE m.trip_id = _trip_id
      AND m.user_id = v_user
  ) THEN
    RAISE EXCEPTION 'You are not a member of this trip';
  END IF;

  IF jsonb_typeof(_updates) <> 'array' THEN
    RAISE EXCEPTION 'Schedule updates must be an array';
  END IF;

  FOR v_update IN SELECT value FROM jsonb_array_elements(_updates)
  LOOP
    BEGIN
      v_id := (v_update ->> 'id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid itinerary row id';
    END;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Each schedule update needs an id';
    END IF;

    SELECT i.updated_at
    INTO v_current
    FROM public.itinerary_items i
    WHERE i.id = v_id
      AND i.trip_id = _trip_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Itinerary row does not belong to this trip';
    END IF;

    v_expected := NULL;
    IF _expected_versions ? v_id::text THEN
      BEGIN
        v_expected := NULLIF(_expected_versions ->> v_id::text, '')::timestamptz;
      EXCEPTION WHEN invalid_datetime_format THEN
        RAISE EXCEPTION 'Invalid itinerary version';
      END;
    END IF;

    -- A row may appear more than once (a move and a retime of one stop). Its
    -- version is checked on the first update only: the first one moves
    -- updated_at, and the later ones are this same call, not someone else.
    IF v_expected IS NOT NULL
      AND NOT (v_id = ANY(v_ids))
      AND v_current IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'itinerary_version_conflict:%', v_id
        USING ERRCODE = '40001';
    END IF;

    UPDATE public.itinerary_items
    SET
      day_date = CASE
        WHEN v_update ? 'day_date' THEN NULLIF(v_update ->> 'day_date', '')::date
        ELSE day_date
      END,
      time_label = CASE
        WHEN v_update ? 'time_label' THEN v_update ->> 'time_label'
        ELSE time_label
      END,
      position = CASE
        WHEN v_update ? 'position' THEN (v_update ->> 'position')::integer
        ELSE position
      END,
      updated_by = v_user
    WHERE id = v_id
      AND trip_id = _trip_id;

    IF NOT (v_id = ANY(v_ids)) THEN
      v_ids := array_append(v_ids, v_id);
    END IF;
  END LOOP;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'day_date', i.day_date,
          'time_label', i.time_label,
          'position', i.position,
          'updated_at', i.updated_at,
          'updated_by', i.updated_by
        )
        ORDER BY array_position(v_ids, i.id)
      )
      FROM public.itinerary_items i
      WHERE i.id = ANY(v_ids)
        AND i.trip_id = _trip_id
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_itinerary_schedule(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_itinerary_schedule(uuid, jsonb, jsonb) TO authenticated, service_role;
