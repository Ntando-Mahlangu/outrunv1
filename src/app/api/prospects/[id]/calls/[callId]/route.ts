import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import * as companyRepository from "@/lib/repositories/company-repository";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; callId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  }

  const { id, callId } = await params;
  const company = await companyRepository.findByIdForOrg(organization.id, id);
  if (!company) {
    return NextResponse.json({ error: "That prospect could not be found." }, { status: 404 });
  }

  const existing = await prisma.callLog.findFirst({ where: { id: callId, companyId: id } });
  if (!existing) {
    return NextResponse.json({ error: "That call log could not be found." }, { status: 404 });
  }

  await prisma.callLog.delete({ where: { id: callId } });
  return NextResponse.json({ ok: true });
}
