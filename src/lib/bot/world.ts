import type { Person } from "@/lib/types";
import type {
  Community,
  Keyword,
  Member,
  ModEvent,
  Payment,
  Pending,
  Plan,
  Role,
  Subscription,
} from "@/lib/types";

export type Actor = Person & { telegramUserId?: string };

export type World = {
  actor: Actor;
  role: Role;
  actingAs: "self" | "adaeze";
  pending: Pending;
  communities: Community[];
  plans: Plan[];
  members: Member[];
  subscriptions: Subscription[];
  payments: Payment[];
  keywords: Keyword[];
  modEvents: ModEvent[];
  reminded: string[];
  now: number;
  /** True when driven by the live Telegram webhook — demo controls stay off. */
  live?: boolean;
  /** Operator Telegram wallet (/take) — never inferred from role in live mode. */
  operator?: boolean;
};

export function ownedCommunity(world: World) {
  return world.communities.find((c) => c.ownerId === world.actor.id);
}

export function communityBySlug(world: World, slug: string) {
  const q = slug.trim().toLowerCase().replace(/^\//, "");
  if (!q) return undefined;
  const list = world.communities;
  const exact = list.find(
    (c) =>
      c.slug === q ||
      c.code.toLowerCase() === q ||
      c.name.toLowerCase() === q ||
      c.id === slug,
  );
  if (exact) return exact;
  if (q.length < 3) return undefined;
  const hits = list.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.slug.includes(q) ||
      c.code.toLowerCase().includes(q),
  );
  if (hits.length === 0) return undefined;
  const starts = hits.find(
    (c) => c.name.toLowerCase().startsWith(q) || c.code.toLowerCase().startsWith(q),
  );
  return starts ?? hits[0];
}

export function plansFor(world: World, communityId: string) {
  return world.plans
    .filter((p) => p.communityId === communityId && p.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function publicCommunities(world: World) {
  return world.communities.filter((c) => c.isPublic);
}

export function issueCreatorCode(name: string, taken: Set<string>) {
  const letters = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4) || "CRE";
  const suffix = () => Math.random().toString(36).slice(2, 5).toUpperCase();
  let code = `${letters}-${suffix()}`;
  let guard = 0;
  while (taken.has(code.toLowerCase()) && guard < 50) {
    code = `${letters}-${suffix()}`;
    guard += 1;
  }
  return code;
}

export function issueSlug(name: string, taken: Set<string>) {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "my-room";
  if (!taken.has(base)) return base;
  let n = 2;
  let slug = `${base.slice(0, 28)}-${n}`;
  while (taken.has(slug) && n < 1000) {
    n += 1;
    slug = `${base.slice(0, 28)}-${n}`;
  }
  return slug;
}

export function issueBindToken() {
  const raw = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BIND-${raw}`;
}

export function parseBindCommand(text: string): string | null {
  const m = text.trim().match(/^\/bind(?:@[A-Za-z0-9_]+)?\s+(BIND-[A-Za-z0-9]+)\s*$/i);
  return m?.[1] ? m[1].toUpperCase() : null;
}

