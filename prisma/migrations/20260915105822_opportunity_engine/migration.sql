-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('DETECTED', 'LAUNCHED', 'DISMISSED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'OPPORTUNITY_DETECTED';
ALTER TYPE "EventType" ADD VALUE 'OPPORTUNITY_LAUNCHED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'OPPORTUNITY_DETECTED';

-- CreateTable
CREATE TABLE "opportunity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "confidence" INTEGER NOT NULL,
    "estimatedImpact" TEXT NOT NULL,
    "estimatedValue" INTEGER,
    "recommendedAction" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionPayload" JSONB,
    "relatedCompanyIds" JSONB,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'DETECTED',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "launchedByUserId" TEXT,
    "executionResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunity_organizationId_status_idx" ON "opportunity"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_organizationId_dedupeKey_key" ON "opportunity"("organizationId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
