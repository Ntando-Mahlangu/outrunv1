import { z } from "zod";

export const growthStageOptions = [
  "IDEA",
  "STARTUP",
  "GROWING",
  "ESTABLISHED",
  "AGENCY",
  "ENTERPRISE",
] as const;

export const sellingLocationOptions = [
  "Local",
  "National",
  "International",
  "Remote / online only",
] as const;

export const acquisitionChannelOptions = [
  "Referrals",
  "SEO",
  "Cold Email",
  "Paid Ads",
  "LinkedIn",
  "Networking",
  "Word of Mouth",
  "Other",
] as const;

export const growthChallengeOptions = [
  "Finding leads",
  "Closing sales",
  "Low website traffic",
  "Poor conversion",
  "Marketing",
  "Retention",
  "Scaling",
  "Cash flow",
  "Other",
] as const;

export const mainGoalOptions = [
  "First customer",
  "$10k MRR",
  "Scale sales",
  "Expand internationally",
  "Increase recurring revenue",
  "Generate more qualified leads",
  "Other",
] as const;

export const businessDiscoverySchema = z.object({
  description: z.string().min(10, "Tell us a bit more about your business."),
  idealCustomer: z.string().min(3, "Describe who you're trying to reach."),
  sellingLocations: z.array(z.string()).min(1, "Pick at least one."),
  acquisitionChannels: z.array(z.string()).min(1, "Pick at least one."),
  growthChallenge: z.string().min(1),
  avgCustomerValue: z.number().int().positive().nullable(),
  growthStage: z.enum(growthStageOptions),
  mainGoal: z.string().min(1),
  website: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().url("Enter a valid website URL, like https://example.com.").nullable(),
  ),
  competitors: z.array(z.string()),
});

export type BusinessDiscoveryInput = z.infer<typeof businessDiscoverySchema>;
