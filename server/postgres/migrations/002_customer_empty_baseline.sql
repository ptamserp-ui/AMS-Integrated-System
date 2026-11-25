CREATE TABLE ams_customer_shadow.empty_baseline (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  source_key text NOT NULL DEFAULT 'sales_pelanggan' CHECK (source_key = 'sales_pelanggan'),
  source_version bigint NOT NULL CHECK (source_version = 0),
  source_present boolean NOT NULL CHECK (source_present = false),
  initialized_by text NOT NULL CHECK (initialized_by ~ '[^[:space:]]'),
  initialized_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION ams_customer_shadow.initialize_empty_baseline(actor text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count integer;
BEGIN
  IF actor IS NULL OR actor !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'Actor is required';
  END IF;
  LOCK TABLE ams_customer_shadow.customers IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM ams_customer_shadow.customers) THEN
    RAISE EXCEPTION 'Customer shadow is not empty';
  END IF;
  INSERT INTO ams_customer_shadow.empty_baseline (source_version, source_present, initialized_by)
  VALUES (0, false, actor)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count = 1;
END;
$$;
