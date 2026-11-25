\set ON_ERROR_STOP off
\set VERBOSITY default
\echo '-- S2-01-S1: the SR-08 constraints and trigger on the test database (everything is rolled back)'
BEGIN;
SELECT conname FROM pg_constraint WHERE conname IN ('event_deadline_before_start','event_cancel_fields','registration_cancel_fields') ORDER BY conname;
SELECT tgname FROM pg_trigger WHERE tgname = 'event_change_append_only';
\echo '-- 1. a registration deadline 1 minute after the start (BR-08)'
SAVEPOINT s; UPDATE "Event" SET "registrationDeadline" = "startAt" + interval '1 minute' WHERE "seedKey" = 'EV-1'; ROLLBACK TO s;
\echo '-- 2. CANCELLED without a reason (BR-12)'
SAVEPOINT s; UPDATE "Event" SET "status" = 'CANCELLED', "cancelledAt" = now(), "cancelledById" = "organizerId" WHERE "seedKey" = 'EV-1'; ROLLBACK TO s;
\echo '-- 3. a registration CANCELLED without cancelledAt (FR-28)'
SAVEPOINT s; UPDATE "Registration" SET "status" = 'CANCELLED' WHERE id = (SELECT min(id) FROM "Registration" WHERE "status" = 'REGISTERED'); ROLLBACK TO s;
\echo '-- 4. UPDATE and DELETE on the change history (X-11)'
SAVEPOINT s; UPDATE "EventChange" SET "newValue" = 'x'; ROLLBACK TO s;
SAVEPOINT s; DELETE FROM "EventChange"; ROLLBACK TO s;
SELECT count(*) AS change_rows FROM "EventChange";
ROLLBACK;
