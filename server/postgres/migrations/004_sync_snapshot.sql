CREATE TABLE ams_sync_shadow.snapshot_import (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  source_revision bigint NOT NULL CHECK (source_revision >= 0),
  imported_by text NOT NULL CHECK (imported_by ~ '[^[:space:]]'),
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION ams_sync_shadow.import_snapshot(snapshot jsonb, actor text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  source_revision bigint;
  source_hash text;
  existing_hash text;
  current_revision bigint;
  versions jsonb;
  item_key text;
  item_entry jsonb;
  entry_version bigint;
  key_version bigint;
  imported_count integer := 0;
BEGIN
  IF jsonb_typeof(snapshot) IS DISTINCT FROM 'object'
    OR jsonb_typeof(snapshot -> 'entries') IS DISTINCT FROM 'object'
    OR jsonb_typeof(snapshot -> 'revision') IS DISTINCT FROM 'number'
    OR (snapshot ->> 'revision') !~ '^(0|[1-9][0-9]{0,15})$'
    OR actor IS NULL OR actor !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'Invalid sync snapshot';
  END IF;
  source_revision := (snapshot ->> 'revision')::bigint;
  IF source_revision > 9007199254740991 THEN
    RAISE EXCEPTION 'Snapshot revision exceeds safe integer range';
  END IF;
  IF snapshot ? 'keyVersions' AND jsonb_typeof(snapshot -> 'keyVersions') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid snapshot key versions';
  END IF;
  versions := COALESCE(snapshot -> 'keyVersions', '{}'::jsonb);
  source_hash := encode(sha256(convert_to(snapshot::text, 'UTF8')), 'hex');

  SELECT revision INTO current_revision FROM ams_sync_shadow.state WHERE singleton FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sync state is missing';
  END IF;
  SELECT snapshot_import.source_hash INTO existing_hash FROM ams_sync_shadow.snapshot_import WHERE singleton;
  IF FOUND THEN
    IF existing_hash <> source_hash OR current_revision <> source_revision THEN
      RAISE EXCEPTION 'Snapshot differs or shadow has changed';
    END IF;
    RETURN jsonb_build_object('replayed', true, 'revision', current_revision);
  END IF;
  IF current_revision <> 0 OR EXISTS (SELECT 1 FROM ams_sync_shadow.entries) THEN
    RAISE EXCEPTION 'Sync shadow is not empty';
  END IF;

  FOR item_key, item_entry IN SELECT key, value FROM jsonb_each(snapshot -> 'entries')
  LOOP
    IF item_key !~ '^[a-zA-Z0-9_-]{1,80}$' OR item_key IN ('rb_akun', 'rb_role')
      OR jsonb_typeof(item_entry) IS DISTINCT FROM 'object'
      OR NOT item_entry ? 'value'
      OR jsonb_typeof(item_entry -> 'version') IS DISTINCT FROM 'number'
      OR (item_entry ->> 'version') !~ '^[1-9][0-9]{0,15}$'
      OR jsonb_typeof(item_entry -> 'updatedAt') IS DISTINCT FROM 'string'
      OR jsonb_typeof(item_entry -> 'updatedBy') IS DISTINCT FROM 'string'
      OR (item_entry ->> 'updatedBy') !~ '[^[:space:]]'
      OR EXISTS (SELECT 1 FROM jsonb_object_keys(item_entry) AS extra(key) WHERE key NOT IN ('value', 'version', 'updatedAt', 'updatedBy')) THEN
      RAISE EXCEPTION 'Invalid or unsupported sync entry';
    END IF;
    entry_version := (item_entry ->> 'version')::bigint;
    IF entry_version > 9007199254740991 THEN
      RAISE EXCEPTION 'Snapshot entry version exceeds safe integer range';
    END IF;
    IF snapshot ? 'keyVersions' AND NOT (versions ? item_key) THEN
      RAISE EXCEPTION 'Snapshot entry key version is missing';
    END IF;
    IF versions ? item_key THEN
      IF jsonb_typeof(versions -> item_key) IS DISTINCT FROM 'number'
        OR (versions ->> item_key) !~ '^(0|[1-9][0-9]{0,15})$' THEN
        RAISE EXCEPTION 'Invalid snapshot key version';
      END IF;
      key_version := (versions ->> item_key)::bigint;
      IF key_version <> entry_version THEN
        RAISE EXCEPTION 'Snapshot entry and key versions differ';
      END IF;
    END IF;
    INSERT INTO ams_sync_shadow.entries (key, version, value, deleted, updated_at, updated_by)
    VALUES (item_key, entry_version, item_entry -> 'value', false, (item_entry ->> 'updatedAt')::timestamptz, item_entry ->> 'updatedBy');
    imported_count := imported_count + 1;
  END LOOP;

  FOR item_key, item_entry IN SELECT key, value FROM jsonb_each(versions)
  LOOP
    IF item_key !~ '^[a-zA-Z0-9_-]{1,80}$' OR item_key IN ('rb_akun', 'rb_role')
      OR jsonb_typeof(item_entry) IS DISTINCT FROM 'number'
      OR item_entry::text !~ '^(0|[1-9][0-9]{0,15})$' THEN
      RAISE EXCEPTION 'Invalid snapshot key version';
    END IF;
    key_version := item_entry::text::bigint;
    IF key_version > 9007199254740991 THEN
      RAISE EXCEPTION 'Snapshot key version exceeds safe integer range';
    END IF;
    IF NOT (snapshot -> 'entries' ? item_key) THEN
      IF key_version = 0 THEN
        RAISE EXCEPTION 'Zero-version tombstone cannot be preserved';
      END IF;
      INSERT INTO ams_sync_shadow.entries (key, version, value, deleted, updated_at, updated_by)
      VALUES (item_key, key_version, NULL, true, now(), actor);
      imported_count := imported_count + 1;
    END IF;
  END LOOP;

  UPDATE ams_sync_shadow.state SET revision = source_revision WHERE singleton;
  INSERT INTO ams_sync_shadow.snapshot_import (source_hash, source_revision, imported_by)
  VALUES (source_hash, source_revision, actor);
  RETURN jsonb_build_object('replayed', false, 'revision', source_revision, 'imported', imported_count);
END;
$$;
