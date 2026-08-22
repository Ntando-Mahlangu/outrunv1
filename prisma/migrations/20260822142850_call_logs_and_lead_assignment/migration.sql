-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('ANSWERED', 'VOICEMAIL', 'NO_ANSWER', 'CALLBACK_REQUESTED', 'NOT_INTERESTED', 'WRONG_NUMBER', 'DO_NOT_CALL');

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'CALL_LOGGED';

-- AlterTable
ALTER TABLE "company" ADD COLUMN     "assignedToUserId" TEXT;

-- CreateTable
CREATE TABLE "call_log" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "loggedByUserId" TEXT NOT NULL,
    "loggedByName" TEXT NOT NULL,
    "outcome" "CallOutcome" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "call_log_companyId_createdAt_idx" ON "call_log"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "company_organizationId_assignedToUserId_idx" ON "company"("organizationId", "assignedToUserId");

-- AddForeignKey
ALTER TABLE "call_log" ADD CONSTRAINT "call_log_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_log" ADD CONSTRAINT "call_log_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
