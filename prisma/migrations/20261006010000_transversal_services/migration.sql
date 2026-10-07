CREATE TABLE "file_blobs" (
  "file_id" TEXT NOT NULL PRIMARY KEY,
  "content" BYTEA NOT NULL,
  "checksum" TEXT NOT NULL,
  CONSTRAINT "file_blobs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "audit_seals" (
  "event_id" TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "sequence" BIGINT NOT NULL,
  "previous_hash" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "chain_hash" TEXT NOT NULL,
  "event_created_at" TEXT NOT NULL,
  "sealed_at" BIGINT NOT NULL,
  CONSTRAINT "audit_seals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "audit_seals_organization_id_sequence_key" UNIQUE ("organization_id", "sequence")
);

CREATE TABLE "email_outbox" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL,
  "next_attempt_at" BIGINT NOT NULL,
  "created_at" BIGINT NOT NULL,
  "sent_at" BIGINT,
  "provider_id" TEXT,
  "last_error" TEXT,
  CONSTRAINT "email_outbox_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "email_outbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "email_outbox_status_next_attempt_at_idx" ON "email_outbox"("status", "next_attempt_at");

DO $$
DECLARE table_name TEXT;
DECLARE api_role TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['file_blobs', 'audit_seals', 'email_outbox'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF to_regrole(api_role) IS NOT NULL THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, api_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
