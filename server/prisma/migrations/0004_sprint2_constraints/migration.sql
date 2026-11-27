-- Database-level backing for the Sprint 2 rules (Sprint 2 contracts §1 SR-08 Data, SDS §4.3).
-- Prisma cannot express these in schema.prisma, so they are raw SQL. Tested by TEST-SR8-02 and TEST-SR8-03.

-- BR-08: a registration deadline, when set, is at or before the start.
ALTER TABLE "Event" ADD CONSTRAINT event_deadline_before_start
  CHECK ("registrationDeadline" IS NULL OR "registrationDeadline" <= "startAt");

-- BR-12, FR-28: the time, the canceller and the reason are all set if and only if the event is cancelled.
ALTER TABLE "Event" ADD CONSTRAINT event_cancel_fields CHECK (
  ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "cancelledById" IS NOT NULL AND "cancelReason" IS NOT NULL)
  OR ("status" <> 'CANCELLED' AND "cancelledAt" IS NULL AND "cancelledById" IS NULL AND "cancelReason" IS NULL));

-- FR-28: a registration records when it was cancelled, and only a cancelled one has that time.
ALTER TABLE "Registration" ADD CONSTRAINT registration_cancel_fields
  CHECK (("status" IN ('CANCELLED', 'EVENT_CANCELLED')) = ("cancelledAt" IS NOT NULL));

-- X-11: change history is append-only. TRUNCATE (used only by the test reset) does not fire row triggers.
CREATE FUNCTION reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'event_change_append_only: EventChange rows cannot be updated or deleted (X-11)';
END;
$$;

CREATE TRIGGER event_change_append_only BEFORE UPDATE OR DELETE ON "EventChange"
  FOR EACH ROW EXECUTE FUNCTION reject_change();
