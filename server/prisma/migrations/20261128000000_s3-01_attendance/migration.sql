-- Sprint 3, S3-01 Feature-P check-in and undo (Sprint 3 contracts §1 Data, SDS §4.1 and §4.3).
-- The contract named this folder 0005_sprint3_attendance; AGENTS.md §4 gives every new folder a timestamp prefix.

-- FR-28: a check-in and an undo are recorded as `attendance` rows that also name the registration.
ALTER TYPE "ChangeField" ADD VALUE 'attendance';

-- Who checked the player in, and when (FR-21, FR-28). Null until checked in; cleared again by an undo (FR-22).
ALTER TABLE "Registration" ADD COLUMN "checkedInAt" TIMESTAMPTZ(3),
                           ADD COLUMN "checkedInById" INTEGER;
ALTER TABLE "EventChange" ADD COLUMN "registrationId" INTEGER;

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_checkedInById_fkey"
  FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventChange" ADD CONSTRAINT "EventChange_registrationId_fkey"
  FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BR-19, FR-28: the time and the organizer are both set if and only if the registration is CHECKED_IN.
-- Sprint 1 and 2 code never wrote CHECKED_IN, so existing rows pass.
ALTER TABLE "Registration" ADD CONSTRAINT registration_checkin_fields CHECK (
  ("status" = 'CHECKED_IN' AND "checkedInAt" IS NOT NULL AND "checkedInById" IS NOT NULL)
  OR ("status" <> 'CHECKED_IN' AND "checkedInAt" IS NULL AND "checkedInById" IS NULL));
