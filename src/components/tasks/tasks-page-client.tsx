"use client";

import { useState } from "react";
import type { Task, TaskImpact } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ImpactBadge } from "@/components/ui/badge";
import type { CoachFeedbackData } from "@/lib/growth-partner/coach-schema";
import { SplitHeading } from "@/components/motion/split-heading";
import { Magnetic } from "@/components/motion/magnetic";
import { readJsonSafely } from "@/lib/fetch-json";

const IMPACTS: TaskImpact[] = ["High", "Medium", "Low"];

export function TasksPageClient({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState<TaskImpact>("Medium");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = tasks.filter((t) => t.status === "PENDING");
  const done = tasks.filter((t) => t.status !== "PENDING");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsAdding(true);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, impact }),
      });
      const body = await readJsonSafely(res);
      if (!res.ok) throw new Error((body?.error as string) ?? "We couldn't add that task.");

      setTasks((prev) => [body!.task as Task, ...prev]);
      setTitle("");
      setDescription("");
      setImpact("Medium");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't add that task.");
    } finally {
      setIsAdding(false);
    }
  }

  async function updateStatus(id: string, status: "COMPLETED" | "DISMISSED" | "PENDING") {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await readJsonSafely(res);
      if (!res.ok) throw new Error((body?.error as string) ?? "We couldn't update that task.");
      setTasks((prev) => prev.map((t) => (t.id === id ? (body!.task as Task) : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't update that task.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <SplitHeading
          as="h1"
          text="Growth Tasks"
          className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Every roadmap recommendation lives here as a completable task, alongside anything you add
          yourself.
        </p>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">Add a task</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <FormError message={error} />
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Input
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-impact">Impact</Label>
            <Select
              id="task-impact"
              value={impact}
              onChange={(e) => setImpact(e.target.value as TaskImpact)}
              className="max-w-40"
            >
              {IMPACTS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </Select>
          </div>
          <Magnetic strength={0.15} className="inline-block">
            <Button type="submit" disabled={isAdding}>
              {isAdding ? "Adding…" : "Add task"}
            </Button>
          </Magnetic>
        </form>
      </Card>

      <Card interactive>
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Nothing pending — generate a Growth Blueprint to get a full list of recommendations.
          </p>
        ) : (
          <ul className="space-y-4">
            {pending.map((task) => (
              <li
                key={task.id}
                className="border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{task.title}</p>
                    {task.description && (
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {task.description}
                      </p>
                    )}
                    {task.effort && (
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        Estimated effort: {task.effort}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <ImpactBadge level={task.impact} label={`${task.impact} impact`} />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="secondary"
                    className="h-9 px-3 text-sm"
                    disabled={busyId === task.id}
                    onClick={() => updateStatus(task.id, "COMPLETED")}
                  >
                    Mark complete
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9 px-3 text-sm"
                    disabled={busyId === task.id}
                    onClick={() => updateStatus(task.id, "DISMISSED")}
                  >
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {done.length > 0 && (
        <Card interactive>
          <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
            Completed &amp; dismissed
          </h2>
          <ul className="space-y-3">
            {done.map((task) => {
              const coachFeedback = task.coachFeedback as CoachFeedbackData | null;
              return (
                <li
                  key={task.id}
                  className="border-b border-[var(--color-border)] pb-3 text-sm last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span
                      className={
                        task.status === "COMPLETED"
                          ? "text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-muted)] line-through"
                      }
                    >
                      {task.title}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {task.status === "COMPLETED" ? "Completed" : "Dismissed"}
                    </span>
                  </div>
                  {coachFeedback && (
                    <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--color-accent)]/30 bg-[var(--color-bg-secondary)] p-3">
                      <p className="text-xs font-medium text-[var(--color-accent-text)]">AI Coach</p>
                      <p className="mt-1 text-[var(--color-text-primary)]">{coachFeedback.celebration}</p>
                      <p className="mt-1 text-[var(--color-text-secondary)]">
                        {coachFeedback.whyItMattered}
                      </p>
                      <p className="mt-1 text-[var(--color-text-secondary)]">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          Recommended next step:{" "}
                        </span>
                        {coachFeedback.recommendedNextStep}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
