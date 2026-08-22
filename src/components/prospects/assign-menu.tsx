"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { FormError } from "@/components/ui/form-error";
import { readJsonSafely } from "@/lib/fetch-json";

export function AssignMenu({
  companyId,
  members,
  initialAssignedToUserId,
}: {
  companyId: string;
  members: { userId: string; name: string }[];
  initialAssignedToUserId: string | null;
}) {
  const [assignedToUserId, setAssignedToUserId] = useState(initialAssignedToUserId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleChange(value: string) {
    const previous = assignedToUserId;
    setAssignedToUserId(value);
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/prospects/${companyId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToUserId: value || null }),
      });
      const body = await readJsonSafely(res);
      if (!res.ok) throw new Error((body?.error as string) ?? "We couldn't assign that prospect.");
    } catch (err) {
      setAssignedToUserId(previous);
      setError(err instanceof Error ? err.message : "We couldn't assign that prospect.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Select
        aria-label="Assigned to"
        className="h-9 w-44 px-3 text-sm"
        value={assignedToUserId}
        disabled={isSaving}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </Select>
      <FormError message={error} />
    </div>
  );
}
