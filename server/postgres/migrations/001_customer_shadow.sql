CREATE SCHEMA ams_customer_shadow;

CREATE TABLE ams_customer_shadow.customers (
  source_record jsonb NOT NULL,
  source_version bigint NOT NULL CHECK (source_version >= 0),
  imported_at timestamptz NOT NULL DEFAULT now(),
  id text GENERATED ALWAYS AS (source_record ->> 'id') STORED PRIMARY KEY,
  customer_code text GENERATED ALWAYS AS (source_record ->> 'kodePelanggan') STORED NOT NULL,
  customer_name text GENERATED ALWAYS AS (source_record ->> 'namaInstalasi') STORED NOT NULL,
  CHECK (jsonb_typeof(source_record) = 'object'),
  CHECK (jsonb_typeof(source_record -> 'id') IS NOT DISTINCT FROM 'string'),
  CHECK (jsonb_typeof(source_record -> 'kodePelanggan') IS NOT DISTINCT FROM 'string'),
  CHECK (jsonb_typeof(source_record -> 'namaInstalasi') IS NOT DISTINCT FROM 'string'),
  CHECK (id ~ '[^[:space:]]'),
  CHECK (customer_code ~ '[^[:space:]]' AND customer_code !~ '[[:cntrl:]]'),
  CHECK (customer_name ~ '[^[:space:]]')
);

CREATE UNIQUE INDEX customers_code_unique
  ON ams_customer_shadow.customers (lower(btrim(customer_code)));

CREATE FUNCTION ams_customer_shadow.import_batch(records jsonb, collection_version bigint)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count integer;
BEGIN
  IF jsonb_typeof(records) IS DISTINCT FROM 'array' OR collection_version IS NULL OR collection_version < 0 THEN
    RAISE EXCEPTION 'Invalid customer batch or source version';
  END IF;
  IF jsonb_array_length(records) > 10000 THEN
    RAISE EXCEPTION 'Customer batch exceeds 10000 records';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(records) AS item(record)
    GROUP BY record ->> 'id' HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(records) AS item(record)
    GROUP BY lower(btrim(record ->> 'kodePelanggan')) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate customer ID or code in batch';
  END IF;

  INSERT INTO ams_customer_shadow.customers (source_record, source_version)
  SELECT record, collection_version FROM jsonb_array_elements(records) AS item(record)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(records) AS item(record)
    LEFT JOIN ams_customer_shadow.customers AS customer ON customer.id = record ->> 'id'
    WHERE customer.id IS NULL OR customer.source_record IS DISTINCT FROM record
      OR customer.source_version IS DISTINCT FROM collection_version
  ) THEN
    RAISE EXCEPTION 'Customer batch conflicts with existing shadow data';
  END IF;
  RETURN inserted_count;
END;
$$;
