-- Sprint 2 data foundation (Sprint 2 contracts §1 SR-08, SDS §4.1): event status fields, deadline, cancel and game
-- columns, the store games and contact, Registration.cancelledAt and the EventChange history table.
-- Generated with `prisma migrate diff`. The SQL rules come separately in 0004_sprint2_constraints.

-- CreateEnum
CREATE TYPE "Game" AS ENUM ('POKEMON', 'MAGIC', 'ONE_PIECE', 'YUGIOH', 'DIGIMON', 'LORCANA', 'OTHER');

-- CreateEnum
CREATE TYPE "ChangeField" AS ENUM ('status', 'details', 'capacity', 'deadline');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contactEmail" VARCHAR(254),
ADD COLUMN     "contactLine" VARCHAR(40),
ADD COLUMN     "contactPhone" VARCHAR(20),
ADD COLUMN     "contactWebsite" VARCHAR(200),
ADD COLUMN     "games" "Game"[] DEFAULT ARRAY[]::"Game"[];

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "cancelReason" VARCHAR(200),
ADD COLUMN     "cancelledAt" TIMESTAMPTZ(3),
ADD COLUMN     "cancelledById" INTEGER,
ADD COLUMN     "game" "Game" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "registrationDeadline" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "cancelledAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "EventChange" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "changedById" INTEGER NOT NULL,
    "field" "ChangeField" NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "changedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EventChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventChange_eventId_changedAt_idx" ON "EventChange"("eventId", "changedAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventChange" ADD CONSTRAINT "EventChange_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventChange" ADD CONSTRAINT "EventChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

