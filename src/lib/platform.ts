import type { Community, Member, Payment } from "./types";

export function platformSnapshot(input: {
  communities: Community[];
  payments: Payment[];
  members: Member[];
}) {
  const { communities, payments, members } = input;
  const success = payments.filter((p) => p.status === "success");
  const pro = communities.filter((c) => c.platformPlan === "pro").length;
  return {
    creatorCount: communities.length,
    pro,
    trial: communities.filter((c) => c.platformPlan === "trial").length,
    starter: communities.filter((c) => c.platformPlan === "starter").length,
    proUsd: pro * 15,
    gmv: success.reduce((a, p) => a + p.amount, 0),
    cut: success.reduce((a, p) => a + p.platformFee, 0),
    activeSeats: members.filter((m) => m.status === "active").length,
    kicked: members.filter((m) => m.status === "removed").length,
  };
}
