-- Rebuilds everything from empty. Destroys existing data.
DROP TABLE IF EXISTS request_notes CASCADE;
DROP TABLE IF EXISTS return_requests CASCADE;
DROP SEQUENCE IF EXISTS request_ref_seq;
DROP TYPE IF EXISTS request_status, return_reason, resolution_type;

CREATE TYPE request_status AS ENUM ('open', 'in_review', 'approved', 'rejected', 'completed');
CREATE TYPE return_reason AS ENUM ('damaged', 'wrong_item', 'size_issue', 'not_as_described', 'changed_mind');
CREATE TYPE resolution_type AS ENUM ('refund', 'replacement', 'store_credit');

CREATE SEQUENCE request_ref_seq START 1001;

CREATE TABLE return_requests (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference      TEXT NOT NULL UNIQUE
                 DEFAULT ('RD-' || lpad(nextval('request_ref_seq')::text, 6, '0')),
  customer_name  TEXT NOT NULL CHECK (length(trim(customer_name)) > 0),
  customer_email TEXT NOT NULL CHECK (customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  customer_phone TEXT,
  order_number   TEXT NOT NULL CHECK (length(trim(order_number)) > 0),
  item_sku       TEXT NOT NULL CHECK (length(trim(item_sku)) > 0),
  item_name      TEXT NOT NULL CHECK (length(trim(item_name)) > 0),
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  reason         return_reason NOT NULL,
  description    TEXT,
  status         request_status NOT NULL DEFAULT 'open',
  resolution     resolution_type,
  refund_amount  NUMERIC(10, 2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,

  CONSTRAINT refund_amount_matches_resolution CHECK (
       (resolution = 'refund' AND refund_amount > 0)
    OR (resolution IS DISTINCT FROM 'refund' AND refund_amount IS NULL)
  ),
  CONSTRAINT decided_needs_resolution CHECK (
    status NOT IN ('approved', 'completed') OR resolution IS NOT NULL
  )
);

CREATE UNIQUE INDEX one_live_request_per_item
  ON return_requests (lower(order_number), lower(item_sku))
  WHERE status NOT IN ('rejected', 'completed') AND deleted_at IS NULL;

CREATE INDEX idx_requests_status  ON return_requests (status)  WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_reason  ON return_requests (reason)  WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_created ON return_requests (created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE request_notes (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES return_requests(id) ON DELETE RESTRICT,
  body       TEXT NOT NULL CHECK (length(trim(body)) > 0),
  author     TEXT NOT NULL DEFAULT 'Support agent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_request ON request_notes (request_id, created_at);

CREATE OR REPLACE FUNCTION forbid_note_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Notes cannot be edited or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_are_append_only
  BEFORE UPDATE OR DELETE ON request_notes
  FOR EACH ROW EXECUTE FUNCTION forbid_note_change();