-- Database-level backing for the Sprint 1 business rules (System-Level SDS §4.3, SD-04).
-- Prisma cannot express these in schema.prisma, so they are raw SQL. Tested by TEST-SR1-03 … 05.

-- BR-01: capacity is a whole number from 1 to 256 (the column is already an integer).
ALTER TABLE "Event" ADD CONSTRAINT event_capacity_range CHECK ("capacity" BETWEEN 1 AND 256);

-- BR-02: an event ends after it starts and lasts at most 24 hours. "Start in the future" depends on the clock,
-- so it is checked by the API (SR-03), not by the database.
ALTER TABLE "Event" ADD CONSTRAINT event_time_window
  CHECK ("endAt" > "startAt" AND "endAt" <= "startAt" + interval '24 hours');

-- BR-06: at most one ACTIVE registration per participant per event. Cancelled rows may repeat, so a participant
-- can register again after cancelling (FR-20, Sprint 2).
CREATE UNIQUE INDEX registration_one_active
  ON "Registration" ("eventId", "participantId")
  WHERE "status" IN ('REGISTERED', 'CHECKED_IN');
