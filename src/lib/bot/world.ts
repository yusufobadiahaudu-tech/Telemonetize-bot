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
  while (taken.has(code.toLowerCase())) code = `${letters}-${suffix()}`;
  return code;
}
