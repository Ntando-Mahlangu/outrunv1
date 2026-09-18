-- CreateEnum
CREATE TYPE "GrowthPartnerQueryType" AS ENUM ('DECISION', 'WHAT_IF');

-- CreateTable
CREATE TABLE "growth_partner_query" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "GrowthPartnerQueryType" NOT NULL,
    "question" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_partner_query_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "growth_partner_query_organizationId_type_createdAt_idx" ON "growth_partner_query"("organizationId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "growth_partner_query" ADD CONSTRAINT "growth_partner_query_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
