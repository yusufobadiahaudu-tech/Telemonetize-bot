import { SPAM_MARKERS } from "./constants";
import type { FilterAction, Keyword, ModAction } from "./types";

export type Classification = "ok" | "spam" | "abuse" | "keyword";

export function classifyLocal(
  text: string,
  keywords: Keyword[],
): {
  classification: Classification;
  confidence: number;
  action: ModAction;
  reason: string;
} {
  const lower = text.toLowerCase();
  const kw = keywords.find((k) => lower.includes(k.keyword.toLowerCase()));
  if (kw) {
    return {
      classification: "keyword",
      confidence: 0.99,
      action: kw.action === "remove" ? "removed" : "flagged",
      reason: `Keyword filter “${kw.keyword}”.`,
    };
  }
  const hit = SPAM_MARKERS.find((b) => lower.includes(b));
  if (hit) {
    return {
      classification: "spam",
      confidence: 0.82,
      action: "flagged",
      reason: `Matched heuristic “${hit}”.`,
    };
  }
  return {
    classification: "ok",
    confidence: 0.7,
    action: "none",
    reason: "No spam or abuse markers.",
  };
}

export function filterActionLabel(action: FilterAction) {
  return action === "remove" ? "remove" : "flag";
}
