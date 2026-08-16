"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SelectablePill } from "@/components/ui/selectable-pill";
import { saveBusinessDiscovery } from "@/lib/onboarding/actions";
import {
  acquisitionChannelOptions,
  growthChallengeOptions,
  growthStageOptions,
  mainGoalOptions,
  sellingLocationOptions,
} from "@/lib/onboarding/schema";

type Answers = {
  description: string;
  idealCustomer: string;
  sellingLocations: string[];
  acquisitionChannels: string[];
  growthChallenge: string;
  growthChallengeOther: string;
  avgCustomerValue: string;
  growthStage: (typeof growthStageOptions)[number];
  mainGoal: string;
  mainGoalOther: string;
  website: string;
  competitors: string;
};

const INITIAL_ANSWERS: Answers = {
  description: "",
  idealCustomer: "",
  sellingLocations: [],
  acquisitionChannels: [],
  growthChallenge: "",
  growthChallengeOther: "",
  avgCustomerValue: "",
  growthStage: "GROWING",
  mainGoal: "",
  mainGoalOther: "",
  website: "",
  competitors: "",
};

const GROWTH_STAGE_LABELS: Record<(typeof growthStageOptions)[number], string> = {
  IDEA: "Idea",
  STARTUP: "Startup",
  GROWING: "Growing",
  ESTABLISHED: "Established",
  AGENCY: "Agency",
  ENTERPRISE: "Enterprise",
};

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(INITIAL_ANSWERS);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    {
      title: "What does your business do?",
      subtitle: "Describe it like you would to a new customer.",
      canContinue: answers.description.trim().length >= 10,
      render: () => (
        <Textarea
          autoFocus
          aria-labelledby="onboarding-question"
          placeholder="We help accounting firms automate client onboarding…"
          value={answers.description}
          onChange={(e) => setAnswers({ ...answers, description: e.target.value })}
        />
      ),
    },
    {
      title: "Who is your ideal customer?",
      subtitle: "e.g. \"Law firms with 10–50 employees\" or \"Busy parents in the suburbs.\"",
      canContinue: answers.idealCustomer.trim().length >= 3,
      render: () => (
        <Textarea
          autoFocus
          aria-labelledby="onboarding-question"
          placeholder="Independent law firms with 10-50 employees…"
          value={answers.idealCustomer}
          onChange={(e) => setAnswers({ ...answers, idealCustomer: e.target.value })}
        />
      ),
    },
    {
      title: "Where do you sell?",
      subtitle: "Pick everything that applies.",
      canContinue: answers.sellingLocations.length > 0,
      render: () => (
        <div className="flex flex-wrap gap-3">
          {sellingLocationOptions.map((option) => (
            <SelectablePill
              key={option}
              label={option}
              selected={answers.sellingLocations.includes(option)}
              onClick={() =>
                setAnswers({
                  ...answers,
                  sellingLocations: toggle(answers.sellingLocations, option),
                })
              }
            />
          ))}
        </div>
      ),
    },
    {
      title: "How do customers currently find you?",
      subtitle: "Pick everything that applies.",
      canContinue: answers.acquisitionChannels.length > 0,
      render: () => (
        <div className="flex flex-wrap gap-3">
          {acquisitionChannelOptions.map((option) => (
            <SelectablePill
              key={option}
              label={option}
              selected={answers.acquisitionChannels.includes(option)}
              onClick={() =>
                setAnswers({
                  ...answers,
                  acquisitionChannels: toggle(answers.acquisitionChannels, option),
                })
              }
            />
          ))}
        </div>
      ),
    },
    {
      title: "What is your biggest growth challenge?",
      subtitle: "Choose the one that matters most right now.",
      canContinue: Boolean(
        answers.growthChallenge &&
          (answers.growthChallenge !== "Other" || answers.growthChallengeOther.trim()),
      ),
      render: () => (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {growthChallengeOptions.map((option) => (
              <SelectablePill
                key={option}
                label={option}
                selected={answers.growthChallenge === option}
                onClick={() => setAnswers({ ...answers, growthChallenge: option })}
              />
            ))}
          </div>
          {answers.growthChallenge === "Other" && (
            <Input
              autoFocus
              aria-label="Describe your biggest growth challenge"
              placeholder="Tell us more…"
              value={answers.growthChallengeOther}
              onChange={(e) =>
                setAnswers({ ...answers, growthChallengeOther: e.target.value })
              }
            />
          )}
        </div>
      ),
    },
    {
      title: "What's your average customer value?",
      subtitle:
        "Optional — this helps us estimate the pipeline value of new opportunities. Enter a whole number in your local currency.",
      canContinue: true,
      render: () => (
        <Input
          autoFocus
          aria-labelledby="onboarding-question"
          type="number"
          min={0}
          placeholder="e.g. 2500"
          value={answers.avgCustomerValue}
          onChange={(e) => setAnswers({ ...answers, avgCustomerValue: e.target.value })}
        />
      ),
    },
    {
      title: "What stage is your business at?",
      subtitle: "",
      canContinue: true,
      render: () => (
        <div className="flex flex-wrap gap-3">
          {growthStageOptions.map((option) => (
            <SelectablePill
              key={option}
              label={GROWTH_STAGE_LABELS[option]}
              selected={answers.growthStage === option}
              onClick={() => setAnswers({ ...answers, growthStage: option })}
            />
          ))}
        </div>
      ),
    },
    {
      title: "What's your main goal right now?",
      subtitle: "",
      canContinue: Boolean(
        answers.mainGoal && (answers.mainGoal !== "Other" || answers.mainGoalOther.trim()),
      ),
      render: () => (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {mainGoalOptions.map((option) => (
              <SelectablePill
                key={option}
                label={option}
                selected={answers.mainGoal === option}
                onClick={() => setAnswers({ ...answers, mainGoal: option })}
              />
            ))}
          </div>
          {answers.mainGoal === "Other" && (
            <Input
              autoFocus
              aria-label="Describe your main goal"
              placeholder="Tell us more…"
              value={answers.mainGoalOther}
              onChange={(e) => setAnswers({ ...answers, mainGoalOther: e.target.value })}
            />
          )}
        </div>
      ),
    },
    {
      title: "What's your website?",
      subtitle: "Optional, but strongly encouraged — we'll factor it into your analysis.",
      canContinue: true,
      render: () => (
        <Input
          autoFocus
          aria-labelledby="onboarding-question"
          type="url"
          placeholder="https://yourbusiness.com"
          value={answers.website}
          onChange={(e) => setAnswers({ ...answers, website: e.target.value })}
        />
      ),
    },
    {
      title: "Who are your main competitors?",
      subtitle: "Optional. Separate names with commas.",
      canContinue: true,
      render: () => (
        <Input
          autoFocus
          aria-labelledby="onboarding-question"
          placeholder="Acme Co, Northwind Partners…"
          value={answers.competitors}
          onChange={(e) => setAnswers({ ...answers, competitors: e.target.value })}
        />
      ),
    },
  ];

  const current = steps[step];
  const isLastStep = step === steps.length - 1;
  if (!current) return null;

  async function handleContinue() {
    if (!isLastStep) {
      setStep((s) => s + 1);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await saveBusinessDiscovery({
        description: answers.description,
        idealCustomer: answers.idealCustomer,
        sellingLocations: answers.sellingLocations,
        acquisitionChannels: answers.acquisitionChannels,
        growthChallenge:
          answers.growthChallenge === "Other"
            ? answers.growthChallengeOther
            : answers.growthChallenge,
        avgCustomerValue: answers.avgCustomerValue ? Number(answers.avgCustomerValue) : null,
        growthStage: answers.growthStage,
        mainGoal: answers.mainGoal === "Other" ? answers.mainGoalOther : answers.mainGoal,
        website: answers.website,
        competitors: answers.competitors
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      });
    } catch (err) {
      setIsSubmitting(false);
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't save that. Please try again.",
      );
      return;
    }

    // Kick off Blueprint generation in the background rather than blocking
    // on it here — /api/blueprint/generate returns as soon as the job is
    // enqueued (or the Free-plan limit is checked), it never waits for the
    // AI generation itself (see the after() call in src/lib/jobs/queue.ts).
    // A Free account that's already used its one lifetime Blueprint goes
    // straight to it instead of waiting on one that will never come;
    // dashboard's own empty state (src/components/dashboard/blueprint-pending.tsx)
    // shows live progress for everyone else, with a manual retry if this
    // kickoff itself failed (e.g. a network hiccup) — so the business info
    // already saved above is never lost behind that.
    try {
      const res = await fetch("/api/blueprint/generate", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok && body?.hasExistingBlueprint) {
        router.push("/blueprint?blueprintLimitReached=1");
        return;
      }
    } catch {
      // Ignored — see comment above.
    }
    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] px-4 py-16">
      <div className="w-full max-w-lg space-y-6">
        <ProgressBar value={((step + 1) / steps.length) * 100} />

        <Card className="animate-fade-in" key={step}>
          <h1
            id="onboarding-question"
            className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
          >
            {current.title}
          </h1>
          {current.subtitle && (
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {current.subtitle}
            </p>
          )}

          <div className="mt-6 space-y-4">
            <FormError message={error} />
            {current.render()}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || isSubmitting}
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={handleContinue}
              disabled={!current.canContinue || isSubmitting}
            >
              {isSubmitting ? "Saving…" : isLastStep ? "Get Started" : "Continue"}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
