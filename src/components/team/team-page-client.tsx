"use client";

import { useState } from "react";
import type { MembershipRole, Invitation } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Badge } from "@/components/ui/badge";
import { SplitHeading } from "@/components/motion/split-heading";
import { Magnetic } from "@/components/motion/magnetic";

const INVITABLE_ROLES: MembershipRole[] = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"];

type Member = {
  id: string;
  role: MembershipRole;
  user: { id: string; name: string; email: string };
};

export function TeamPageClient({
  currentUserId,
  canManage,
  members: initialMembers,
  invitations: initialInvitations,
}: {
  currentUserId: string;
  canManage: boolean;
  members: Member[];
  invitations: Invitation[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MembershipRole>("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsInviting(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setInvitations((prev) => [body.invitation, ...prev]);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleResend(id: string) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/team/invitations/${id}/resend`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setInvitations((prev) => prev.map((inv) => (inv.id === id ? body.invitation : inv)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(id: string) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/team/invitations/${id}/cancel`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/team/members/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRoleChange(id: string, newRole: MembershipRole) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/team/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: body.member.role } : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <SplitHeading
          as="h1"
          text="Team"
          className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Manage who has access to this workspace.
        </p>
      </div>

      <FormError message={error} />

      {canManage && (
        <Card>
          <Label htmlFor="invite-email">Invite a team member</Label>
          <form onSubmit={handleInvite} className="mt-3 flex flex-col gap-3 sm:flex-row">
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Select
              aria-label="Role for invited member"
              value={role}
              onChange={(e) => setRole(e.target.value as MembershipRole)}
              className="sm:w-40"
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
            <Magnetic strength={0.15} className="inline-block">
              <Button type="submit" disabled={isInviting}>
                {isInviting ? "Sending…" : "Send Invite"}
              </Button>
            </Magnetic>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">Members</h2>
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {member.user.name}
                  {member.user.id === currentUserId && (
                    <span className="text-[var(--color-text-muted)]"> (you)</span>
                  )}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">{member.user.email}</p>
              </div>
              {canManage && member.role !== "OWNER" ? (
                <div className="flex items-center gap-2">
                  <Select
                    aria-label={`Role for ${member.user.name}`}
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as MembershipRole)}
                    disabled={busyId === member.id}
                    className="h-9 w-32 text-xs"
                  >
                    {INVITABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </Select>
                  {member.user.id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(member.id)}
                      disabled={busyId === member.id}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ) : (
                <Badge tone="accent">{member.role.charAt(0) + member.role.slice(1).toLowerCase()}</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>

      {canManage && invitations.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
            Pending Invitations
          </h2>
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{inv.email}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Invited as {inv.role.toLowerCase()} · Expires{" "}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResend(inv.id)}
                    disabled={busyId === inv.id}
                  >
                    Resend
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancel(inv.id)}
                    disabled={busyId === inv.id}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
