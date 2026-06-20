import type { Conversation } from "../api/client";

/** Time-of-day Swedish greeting. */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 10) return "God morgon";
  if (h < 18) return "God eftermiddag";
  return "God kväll";
}

/** Derive a display name from a Cognito email/username (e.g. anna.berg -> Anna). */
export function displayName(email: string | null): string {
  if (!email) return "där";
  const local = email.split("@")[0];
  const first = local.split(/[.\-_]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Up-to-two-letter avatar initials from an email/username. */
export function initials(email: string | null): string {
  if (!email) return "?";
  const parts = email.split("@")[0].split(/[.\-_]/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase());
  return letters.join("") || "?";
}

/** Auto-title a new conversation from its first message. */
export function deriveTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\s+/g, " ");
  if (!clean) return "Ny konversation";
  return clean.length > 48 ? clean.slice(0, 48).trimEnd() + "…" : clean;
}

export type DateBucket = "IDAG" | "IGÅR" | "TIDIGARE";

function bucketFor(iso: string): DateBucket {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (d >= startOfToday) return "IDAG";
  if (d >= startOfYesterday) return "IGÅR";
  return "TIDIGARE";
}

export interface ConversationGroup {
  bucket: DateBucket;
  conversations: Conversation[];
}

/** Group conversations by recency, preserving input order within a bucket. */
export function groupByDate(conversations: Conversation[]): ConversationGroup[] {
  const order: DateBucket[] = ["IDAG", "IGÅR", "TIDIGARE"];
  const map = new Map<DateBucket, Conversation[]>();
  for (const conv of conversations) {
    const b = bucketFor(conv.updated_at || conv.created_at);
    if (!map.has(b)) map.set(b, []);
    map.get(b)!.push(conv);
  }
  return order
    .filter((b) => map.has(b))
    .map((bucket) => ({ bucket, conversations: map.get(bucket)! }));
}
