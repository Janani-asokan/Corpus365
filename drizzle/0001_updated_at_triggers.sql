-- Keep updated_at correct no matter which client writes the row.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'partner_profiles', 'products', 'orders', 'subscriptions',
    'payouts', 'commissions', 'leads', 'quote_requests'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t || '_set_updated_at', t
    );
  END LOOP;
END;
$$;
--> statement-breakpoint
-- The audit log is append-only.
CREATE OR REPLACE FUNCTION forbid_audit_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_changes();
