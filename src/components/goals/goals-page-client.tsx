"use client";

import { useState } from "react";
import type { Goal } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { SplitHeading } from "@/components/motion/split-heading";
import { Magnetic } from "@/components/motion/magnetic";
import { readJsonSafely } from "@/lib/fetch-json";

function progressPercent(goal: Goal): number | null {
  if (goal.targetValue == null || goal.currentValue == null || goal.targetValue === 0) return null;
  return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
}

export function GoalsPageClient({ initialGoals }: { initialGoals: Goal[] }) {
  const [goals, setGoals] = useState(initialGoals);
  const [title, setTitle] = useState("");
  const [targetMetric, setTargetMetric] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const active = goals.filter((g) => g.status === "ACTIVE");
  const inactive = goals.filter((g) => g.status !== "ACTIVE");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsAdding(true);

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          targetMetric: targetMetric || undefined,
          targetValue: targetValue ? Number(targetValue) : undefined,
        }),
      });
      const body = await readJsonSafely(res);
      if (!res.ok) throw new Error((body?.error as string) ?? "We couldn't add that goal.");

      setGoals((prev) => [body!.goal as Goal, ...prev]);
      setTitle("");
      setTargetMetric("");
      setTargetValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't add that goal.");
    } finally {
      setIsAdding(false);
    }
  }

  async function markComplete(id: string) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const body = await readJsonSafely(res);
      if (!res.ok) throw new Error((body?.error as string) ?? "We couldn't update that goal.");
      setGoals((prev) => prev.map((g) => (g.id === id ? (body!.goal as Goal) : g)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't update that goal.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <SplitHeading
          as="h1"
          text="Goals"
          className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Your Growth Partner and Growth Blueprint read these to keep every recommendation aligned with
          what you&apos;re actually trying to achieve.
        </p>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">Add a goal</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <FormError message={error} />
          <div className="space-y-2">
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              placeholder="e.g. First Customer, $10k MRR, 100 Monthly Leads"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goal-metric">Metric (optional)</Label>
              <Input
                id="goal-metric"
                placeholder="e.g. MRR, customers, leads"
                value={targetMetric}
                onChange={(e) => setTargetMetric(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-target">Target value (optional)</Label>
              <Input
                id="goal-target"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </div>
          </div>
          <Magnetic strength={0.15} className="inline-block">
            <Button type="submit" disabled={isAdding}>
              {isAdding ? "Adding…" : "Add goal"}
            </Button>
          </Magnetic>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            No goals set yet — add one above so your Growth Partner and Growth Blueprint can align
            recommendations to it.
          </p>
        ) : (
          <ul className="space-y-4">
            {active.map((goal) => {
              const percent = progressPercent(goal);
              return (
                <li
                  key={goal.id}
                  className="border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">{goal.title}</p>
                      {goal.targetMetric && goal.targetValue != null && (
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          {goal.currentValue ?? 0} / {goal.targetValue} {goal.targetMetric}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      className="h-9 px-3 text-sm"
                      disabled={busyId === goal.id}
                      onClick={() => markComplete(goal.id)}
                    >
                      Mark achieved
                    </Button>
                  </div>
                  {percent != null && (
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
                      <div
                        className="h-full rounded-full bg-[var(--color-accent)]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {inactive.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
            Achieved &amp; abandoned
          </h2>
          <ul className="space-y-3">
            {inactive.map((goal) => (
              <li
                key={goal.id}
                className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-3 text-sm last:border-0 last:pb-0"
              >
                <span className="text-[var(--color-text-primary)]">{goal.title}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {goal.status === "COMPLETED" ? "Achieved" : "Abandoned"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
