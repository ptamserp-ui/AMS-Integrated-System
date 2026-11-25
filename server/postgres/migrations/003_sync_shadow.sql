CREATE SCHEMA ams_sync_shadow;

CREATE TABLE ams_sync_shadow.state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  revision bigint NOT NULL CHECK (revision >= 0)
);

INSERT INTO ams_sync_shadow.state (revision) VALUES (0);

CREATE TABLE ams_sync_shadow.entries (
  key text PRIMARY KEY CHECK (key ~ '^[a-zA-Z0-9_-]{1,80}$' AND key NOT IN ('rb_akun', 'rb_role')),
  version bigint NOT NULL CHECK (version > 0),
  value jsonb,
  deleted boolean NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text NOT NULL CHECK (updated_by ~ '[^[:space:]]'),
  CHECK ((deleted AND value IS NULL) OR (NOT deleted AND value IS NOT NULL))
);

CREATE FUNCTION ams_sync_shadow.apply_batch(
  updates jsonb, deletes jsonb, expected_versions jsonb, actor text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  item_key text;
  item_value jsonb;
  expected bigint;
  current_version bigint;
  current_revision bigint;
  updated_count integer := 0;
  deleted_count integer := 0;
BEGIN
  IF jsonb_typeof(updates) IS DISTINCT FROM 'object'
    OR jsonb_typeof(deletes) IS DISTINCT FROM 'array'
    OR jsonb_typeof(expected_versions) IS DISTINCT FROM 'object'
    OR actor IS NULL OR actor !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'Invalid sync batch';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(deletes) AS item(value) WHERE jsonb_typeof(value) IS DISTINCT FROM 'string')
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(deletes) AS item(key) GROUP BY key HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(deletes) AS item(key) WHERE updates ? key) THEN
    RAISE EXCEPTION 'Invalid or duplicate sync keys';
  END IF;

  SELECT revision INTO current_revision FROM ams_sync_shadow.state WHERE singleton FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sync state is missing';
  END IF;
  FOR item_key IN
    SELECT key FROM jsonb_object_keys(updates) AS item(key)
    UNION ALL SELECT key FROM jsonb_array_elements_text(deletes) AS item(key)
  LOOP
    IF item_key !~ '^[a-zA-Z0-9_-]{1,80}$' OR item_key IN ('rb_akun', 'rb_role')
      OR jsonb_typeof(expected_versions -> item_key) IS DISTINCT FROM 'number'
      OR (expected_versions ->> item_key) !~ '^(0|[1-9][0-9]{0,15})$' THEN
      RAISE EXCEPTION 'Invalid sync key or expected version';
    END IF;
    expected := (expected_versions ->> item_key)::bigint;
    IF expected > 9007199254740991 THEN
      RAISE EXCEPTION 'Expected version exceeds safe integer range';
    END IF;
    SELECT version INTO current_version FROM ams_sync_shadow.entries WHERE key = item_key;
    IF NOT FOUND THEN current_version := 0; END IF;
    IF current_version <> expected THEN
      RAISE EXCEPTION 'Sync version conflict' USING ERRCODE = '40001';
    END IF;
    IF current_version = 9007199254740991 AND (
      updates ? item_key OR EXISTS (SELECT 1 FROM ams_sync_shadow.entries WHERE key = item_key AND NOT deleted)
    ) THEN
      RAISE EXCEPTION 'Sync version exceeds safe integer range';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT key FROM jsonb_object_keys(expected_versions) AS item(key)
    WHERE NOT (updates ? key) AND NOT (deletes ? key)
  ) THEN
    RAISE EXCEPTION 'Unexpected version key';
  END IF;

  FOR item_key, item_value IN SELECT key, value FROM jsonb_each(updates)
  LOOP
    INSERT INTO ams_sync_shadow.entries (key, version, value, deleted, updated_at, updated_by)
    VALUES (item_key, 1, item_value, false, now(), actor)
    ON CONFLICT (key) DO UPDATE SET
      version = ams_sync_shadow.entries.version + 1,
      value = EXCLUDED.value, deleted = false, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;
    updated_count := updated_count + 1;
  END LOOP;

  FOR item_key IN SELECT key FROM jsonb_array_elements_text(deletes) AS item(key)
  LOOP
    UPDATE ams_sync_shadow.entries SET
      version = version + 1, value = NULL, deleted = true, updated_at = now(), updated_by = actor
    WHERE key = item_key AND NOT deleted;
    IF FOUND THEN deleted_count := deleted_count + 1; END IF;
  END LOOP;

  IF updated_count + deleted_count > 0 THEN
    IF current_revision >= 9007199254740991 THEN
      RAISE EXCEPTION 'Sync revision exceeds safe integer range';
    END IF;
    UPDATE ams_sync_shadow.state SET revision = revision + 1 WHERE singleton RETURNING revision INTO current_revision;
  END IF;
  RETURN jsonb_build_object('revision', current_revision, 'updated', updated_count, 'deleted', deleted_count);
END;
$$;

CREATE FUNCTION ams_sync_shadow.reset_all(expected_revision bigint, actor text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  current_revision bigint;
  deleted_versions jsonb;
BEGIN
  IF expected_revision IS NULL OR expected_revision < 0 OR expected_revision > 9007199254740991
    OR actor IS NULL OR actor !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'Invalid sync reset';
  END IF;
  SELECT revision INTO current_revision FROM ams_sync_shadow.state WHERE singleton FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sync state is missing';
  END IF;
  IF expected_revision <> current_revision THEN
    RAISE EXCEPTION 'Sync revision conflict' USING ERRCODE = '40001';
  END IF;
  IF current_revision >= 9007199254740991 OR EXISTS (
    SELECT 1 FROM ams_sync_shadow.entries WHERE NOT deleted AND version >= 9007199254740991
  ) THEN
    RAISE EXCEPTION 'Sync version or revision exceeds safe integer range';
  END IF;
  WITH affected AS (
    UPDATE ams_sync_shadow.entries SET
      version = version + 1, value = NULL, deleted = true, updated_at = now(), updated_by = actor
    WHERE NOT deleted
    RETURNING key, version
  )
  SELECT COALESCE(jsonb_object_agg(key, version), '{}'::jsonb) INTO deleted_versions FROM affected;
  UPDATE ams_sync_shadow.state SET revision = revision + 1 WHERE singleton RETURNING revision INTO current_revision;
  RETURN jsonb_build_object('revision', current_revision, 'deletedVersions', deleted_versions);
END;
$$;
