import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TERMS_VERSION } from "@/lib/legal";

// Records durable, timestamped proof of clickwrap acceptance (docs/outrun/15
// "LEGAL"). Called once from /welcome (src/components/legal/terms-acceptance-recorder.tsx)
// — the one page every sign-up path lands on regardless of method
// (email/password, Google, Microsoft, magic link), since OAuth and magic
// link create a session directly rather than going through the sign-up
// form's own submit handler. The sign-up page's checkbox is the actual
// user-facing gate; this is the record of it, and re-fires (updating the
// timestamp) whenever the accepted version is out of date rather than only
// on first sign-up, so a future "terms changed" re-prompt has somewhere to
// write to.
export async function POST() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Better Auth's session object only carries its own default user fields —
  // termsVersion isn't among them, so this checks the source of truth
  // directly rather than trusting a stale/absent value off the session.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { termsVersion: true },
  });

  if (user?.termsVersion === TERMS_VERSION) {
    return NextResponse.json({ ok: true });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION },
  });

  return NextResponse.json({ ok: true });
}
