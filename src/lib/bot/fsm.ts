import { NG_BANKS, isNuban } from "@/lib/banks";
import {
  FEATURED_CURRENCIES,
  MORE_CURRENCIES,
  formatCharge,
  isCurrency,
  parseCurrency,
  transferDetails,
  type Currency,
} from "@/lib/currency";
import {
  destinationFor,
  feePct,
  formatDate,
  formatMoney,
  intervalLabel,
  providerLabel,
  relativeTime,
} from "@/lib/format";
import { platformSnapshot } from "@/lib/platform";
import { botMention } from "@/lib/product";
import type { InlineBtn, Plan, Provider } from "@/lib/types";
import type { BotEvent, BotReply, Effect, ReduceResult } from "./effects";
import {
  communityBySlug,
  ownedCommunity,
  plansFor,
  publicCommunities,
  type World,
} from "./world";

const MAIN: InlineBtn[][] = [
  [
    { label: "Join a group", payload: "discover", tone: "primary" },
    { label: "I run a group", payload: "become_creator" },
  ],
  [
    { label: "Walk Adaeze’s desk", payload: "as_adaeze" },
    { label: "How it works", payload: "help" },
  ],
  [{ label: "Your take", payload: "take" }],
];

const CUSTOMER_MAIN: InlineBtn[][] = [
  [
    { label: "Join a group", payload: "discover", tone: "primary" },
    { label: "I run a group", payload: "become_creator" },
  ],
  [
    { label: "My seats", payload: "my" },
    { label: "How it works", payload: "help" },
  ],
];

function menu(world: World): InlineBtn[][] {
  return world.role === "member" && world.actingAs === "self" ? CUSTOMER_MAIN : MAIN;
}

function bankButtons(): InlineBtn[][] {
  return NG_BANKS.slice(0, 10).map((b) => [{ label: b.name, payload: `bank:${b.code}` }]);
}

function attachAccountPrompt(code?: string): BotReply[] {
  const who = code ? `ID ${code}` : "this ID";
  return [
    {
      text: `Attach a bank account to ${who}.\n\nEvery card payment on ${who} settles to that account. TeleMonetize only keeps its fee. We never hold the rest.\n\nPick the bank, then send the 10-digit NUBAN.`,
      buttons: bankButtons(),
    },
  ];
}

function planLine(p: Plan) {
  return `${p.name} — ${formatMoney(p.priceUsd)} / ${intervalLabel(p.interval)}\n${p.description}`;
}

const PRO_USD_CENTS = 1500;

function pairCurrencyButtons(
  usdCents: number,
  codes: Currency[],
  payloadFor: (code: Currency) => string,
  leadUsd = false,
): InlineBtn[][] {
  const rows: InlineBtn[][] = [];
  const list = [...codes];
  if (leadUsd && list[0] === "USD") {
    rows.push([
      {
        label: `USD · ${formatCharge(usdCents, "USD")}`,
        payload: payloadFor("USD"),
        tone: "primary",
      },
    ]);
    list.shift();
  }
  for (let i = 0; i < list.length; i += 2) {
    rows.push(
      list.slice(i, i + 2).map((code) => ({
        label: `${code} · ${formatCharge(usdCents, code)}`,
        payload: payloadFor(code),
      })),
    );
  }
  return rows;
}

function featuredCheckoutButtons(planId: string, usdCents: number): InlineBtn[][] {
  return [
    ...pairCurrencyButtons(usdCents, FEATURED_CURRENCIES, (code) => `ccy:${planId}:${code}`, true),
    [
      { label: "More currencies", payload: `moreccy:${planId}` },
      { label: "Type a currency", payload: `typeccy:${planId}` },
    ],
  ];
}

function moreCheckoutButtons(planId: string, usdCents: number): InlineBtn[][] {
  return [
    ...pairCurrencyButtons(usdCents, MORE_CURRENCIES, (code) => `ccy:${planId}:${code}`),
    [{ label: "Back", payload: `plan:${planId}` }],
  ];
}

function featuredProButtons(): InlineBtn[][] {
  return [
    ...pairCurrencyButtons(PRO_USD_CENTS, FEATURED_CURRENCIES, (code) => `proccy:${code}`, true),
    [
      { label: "More currencies", payload: "promore" },
      { label: "Type a currency", payload: "prototype" },
    ],
  ];
}

function out(
  world: World,
  replies: BotReply[],
  extra?: Partial<Pick<ReduceResult, "pending" | "role" | "actingAs" | "effects">>,
): ReduceResult {
  return {
    pending: extra && "pending" in extra ? (extra.pending ?? null) : world.pending,
    role: extra?.role ?? world.role,
    actingAs: extra?.actingAs ?? world.actingAs,
    replies,
    effects: extra?.effects ?? [],
  };
}

export function startWelcome(): BotReply[] {
  return [
    {
      text: `You own this bot.\n\nCreators subscribe and get an ID — like LA-ADA. They bind a group name and a bank account to that ID. Member money for the ID goes to that account. Your percentage credits your Telegram wallet.\n\nCustomers send the ID or the group name to ${botMention()}. They pay in dollars — or another currency — by card or bank transfer. I send the join link after Paystack confirms. They never see the split.\n\nIf they do not renew, I kick them. A server cron runs that loop; /loop is a manual override.`,
      buttons: MAIN,
    },
  ];
}

export function customerWelcome(): BotReply[] {
  return [
    {
      text: `Send a creator ID or the group name. Dollar is the list price — pay in USD or another currency, by card or bank transfer. I send the join link after payment confirms.`,
      buttons: CUSTOMER_MAIN,
    },
  ];
}

function help(world: World): ReduceResult {
  if (world.role === "member" && world.actingAs === "self") {
    return out(world, [
      {
        text: `Send a creator ID or the group name. Try LA-ADA or Lagos Alpha.\n\nPick a plan. Dollar is the list price. Pay in USD, or another currency, by card or bank transfer. I send a one-time join link after Paystack confirms.\n\nAlready in? /my`,
        buttons: CUSTOMER_MAIN,
      },
    ]);
  }
  return out(world, [
    {
      text: `How you make money from creators\n\n1. Mr. A taps I run a group and subscribes — trial at 8%, or Pro $15/month at 5%.\n2. I issue a creator ID (LA-ADA). He binds his group name and a bank account to that ID, then adds ${botMention()} as admin (Invite users + Ban users).\n3. Customers send LA-ADA — or the group name — to ${botMention()}.\n4. They pay. Paystack confirms. I mint a one-time join link. They never see how the money is shared.\n5. Your percentage credits your Telegram wallet. Their share hits the account on that ID. A cron retries, warns, then kicks anyone who does not renew. /loop is a manual override.\n\nThis is one platform bot. Creators do not bring their own BotFather token.\n\nCustomers: send a creator ID or a group name. Try LA-ADA or Lagos Alpha.\nCreators: /studio  /id  /payout  /kick @user  /loop\nYou: /take`,
      buttons: MAIN,
    },
  ]);
}

function discover(world: World): ReduceResult {
  const next = { ...world, role: "member" as const, actingAs: "self" as const };
  const rows = publicCommunities(next);
  const lines = rows.map((c) => {
    const plans = plansFor(next, c.id);
    const low = plans[0];
    const n = next.members.filter((m) => m.communityId === c.id && m.status === "active").length;
    const price = low ? `from ${formatMoney(low.priceUsd)} / ${intervalLabel(low.interval)}` : "no plans";
    return `${c.code}  ·  ${c.name}\n${c.bio}\n${n} in the room · ${price}\nTell people: send ${c.code} or “${c.name}” to ${botMention()}`;
  });
  return out(
    next,
    [
      {
        text: `Send a creator ID or the group name.\n\n${lines.join("\n\n") || "No public groups yet."}`,
        buttons: rows.map((c) => [
          { label: `${c.code} · ${c.name}`, payload: `community:${c.code}`, tone: "primary" as const },
        ]),
      },
    ],
    { role: "member", actingAs: "self" },
  );
}

function showCommunity(world: World, slug: string): ReduceResult {
  const c = communityBySlug(world, slug);
  if (!c) {
    return out(world, [
      { text: "No creator with that ID or group name. Send LA-ADA or Lagos Alpha, or tap Join a group." },
    ]);
  }
  const plans = plansFor(world, c.id);
  const n = world.members.filter((m) => m.communityId === c.id && m.status === "active").length;
  return out(world, [
    {
      text: `${c.name}\nCreator ID ${c.code}\n${c.bio}\n\n${n} members · ${c.chatType}\n\n${plans.map(planLine).join("\n\n")}`,
      buttons: plans.map((p) => [
        {
          label: `${p.name} · ${formatMoney(p.priceUsd)}`,
          payload: `plan:${p.id}`,
          tone: "primary" as const,
        },
      ]),
      kind: "invoice",
    },
  ]);
}

function showPlan(world: World, planId: string): ReduceResult {
  const plan = world.plans.find((p) => p.id === planId);
  if (!plan) return out(world, [{ text: "Plan not found." }]);
  const c = world.communities.find((x) => x.id === plan.communityId);
  if (!c) return out(world, [{ text: "Community not found." }]);
  if (!c.payoutConnected) {
    return out(world, [
      {
        text: `${c.name} · ${plan.name}\nCheckout is not open yet. Try another group, or check back shortly.`,
        buttons: [[{ label: "Join a group", payload: "discover" }]],
      },
    ]);
  }
  return out(world, [
    {
      text: `${c.name} · ${plan.name}\n${plan.description}\n\n${formatMoney(plan.priceUsd)} / ${intervalLabel(plan.interval)}\n\nDollar is the list price. Pay in USD, or pick another currency.`,
      buttons: featuredCheckoutButtons(plan.id, plan.priceUsd),
      kind: "invoice",
    },
  ]);
}

function chooseMethod(world: World, planId: string, currency: Currency): ReduceResult {
  const plan = world.plans.find((p) => p.id === planId);
  if (!plan) return out(world, [{ text: "Plan not found." }]);
  const amount = formatCharge(plan.priceUsd, currency);
  return out(world, [
    {
      text: `Pay ${amount} (${currency}).\n\nCard or bank transfer. I send the join link after Paystack confirms the charge — not before.`,
      buttons: [
        [{ label: `Card · ${amount}`, payload: `pay:${plan.id}:${currency}:card`, tone: "primary" }],
        [{ label: `Bank transfer · ${amount}`, payload: `pay:${plan.id}:${currency}:transfer` }],
      ],
      kind: "invoice",
    },
  ]);
}

function showTransfer(world: World, planId: string, currency: Currency): ReduceResult {
  const plan = world.plans.find((p) => p.id === planId);
  if (!plan) return out(world, [{ text: "Plan not found." }]);
  const community = world.communities.find((x) => x.id === plan.communityId);
  if (!community) return out(world, [{ text: "Community not found." }]);
  const ref = `${community.code}-${world.actor.username}`.replace(/[^A-Z0-9-]/gi, "").slice(0, 18).toUpperCase();
  const details = transferDetails(currency, plan.priceUsd, ref);
  return out(world, [
    {
      text: `Bank transfer\n${community.name} · ${plan.name}\n\n${details.text}\n\nSend the exact amount. I admit you when Paystack confirms — tap I've paid only after you transfer.`,
      buttons: [
        [{ label: "I've paid", payload: `paid:${plan.id}:${currency}:transfer`, tone: "primary" }],
        [{ label: "Pay by card instead", payload: `pay:${plan.id}:${currency}:card` }],
      ],
      kind: "invoice",
    },
  ]);
}

function checkout(
  world: World,
  planId: string,
  provider: Provider,
  currency: Currency,
): ReduceResult {
  const plan = world.plans.find((p) => p.id === planId);
  if (!plan) return out(world, [{ text: "Plan not found." }]);
  const community = world.communities.find((x) => x.id === plan.communityId);
  if (!community) return out(world, [{ text: "Community not found." }]);
  if (!community.payoutConnected) {
    return out(world, [
      {
        text: `${community.name} has no payout account yet. Checkout is closed.`,
        buttons: CUSTOMER_MAIN,
      },
    ]);
  }
  const already = world.members.find(
    (m) => m.communityId === community.id && m.userId === world.actor.id && m.status === "active",
  );
  if (already) {
    return out(world, [{ text: "You already have a seat.", buttons: CUSTOMER_MAIN }]);
  }
  const amount = formatCharge(plan.priceUsd, currency);
  return out(world, [
    {
      text: `Opening ${providerLabel(provider)} checkout for ${community.name} · ${plan.name}.\n${amount}.\n\nThe join link is minted only after Paystack sends charge.success.`,
      kind: "invoice",
    },
  ], {
    pending: null,
    effects: [{ type: "checkout", planId, currency, provider }],
  });
}

function mySeats(world: World): ReduceResult {
  const seats = world.members
    .filter((m) => m.userId === world.actor.id && m.status !== "removed")
    .map((member) => {
      const community = world.communities.find((c) => c.id === member.communityId);
      const sub = world.subscriptions.find(
        (s) => s.userId === world.actor.id && s.communityId === member.communityId,
      );
      const plan = world.plans.find((p) => p.id === sub?.planId);
      return community ? { member, sub, plan, community } : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (!seats.length) {
    return out(world, [
      {
        text: "No seats yet. Pay on a community and I send the invite here after Paystack confirms.",
        buttons: [[{ label: "Join a group", payload: "discover", tone: "primary" }]],
      },
    ]);
  }
  const lines = seats.map(({ community, plan, sub, member }) => {
    const end = sub ? relativeTime(sub.periodEnd) : "—";
    const st = sub?.status ?? member.status;
    return `${community.name} · ${plan?.name ?? "seat"}\n${st.replace("_", " ")} · ends ${end}`;
  });
  return out(world, [
    {
      text: lines.join("\n\n"),
      buttons: seats.map((s) => [
        { label: s.community.name, payload: `openchat:${s.community.chatId}`, tone: "primary" as const },
      ]),
    },
  ]);
}

function becomeCreator(world: World): ReduceResult {
  const nextRole = { role: "creator" as const, actingAs: "self" as const };
  const next = { ...world, ...nextRole };
  if (ownedCommunity(next)) return studio(next);
  return out(
    next,
    [
      {
        text: "Creators subscribe to this bot. Then they get an ID.\n\nTrial — 14 days free. 8% of each member payment credits the operator Telegram wallet.\nPro — $15 / month by card or bank transfer, in USD or another currency. 5% of each member payment.\n\nAfter they pay, they bind a group name and a bank account to the ID, then add this bot as admin. Their share hits that account. Customers pay in any listed currency by card or transfer, and never see the split.",
        buttons: [
          [{ label: "Start 14-day trial", payload: "creator_plan:trial", tone: "primary" }],
          [{ label: "Pay Pro · $15 / month", payload: "pro_pay" }],
          [{ label: "Walk Adaeze’s desk (demo)", payload: "as_adaeze" }],
        ],
      },
    ],
    nextRole,
  );
}

function startCreatorPlan(world: World, plan: "trial" | "pro"): ReduceResult {
  const nextRole = { role: "creator" as const, actingAs: "self" as const };
  const next = { ...world, ...nextRole };
  if (ownedCommunity(next)) return studio(next);
  const paid =
    plan === "pro"
      ? "Pro checkout will open. After Paystack confirms $15, 5% of each member payment will credit the operator Telegram wallet.\n\n"
      : "Trial is on. 8% of each member payment will credit the operator Telegram wallet.\n\n";
  if (plan === "pro") {
    return out(
      next,
      [
        {
          text: `${paid}Opening Pro checkout.`,
        },
      ],
      {
        ...nextRole,
        pending: null,
        effects: [{ type: "checkout_pro", currency: "USD", provider: "card" }],
      },
    );
  }
  return out(
    next,
    [
      {
        text: `${paid}Send the Telegram group name you want bound to your ID (for example “Lagos Desk”).`,
        buttons: [[{ label: "Cancel", payload: "cancel" }]],
      },
    ],
    { ...nextRole, pending: { kind: "await_community_name", platformPlan: plan } },
  );
}

function payPro(world: World): ReduceResult {
  const nextRole = { role: "creator" as const, actingAs: "self" as const };
  const next = { ...world, ...nextRole };
  if (ownedCommunity(next)) return studio(next);
  return out(
    next,
    [
      {
        text: "Pro is $15 / month. Dollar is the list price. Pay in USD, or pick another currency — then card or bank transfer. The ID is issued after Paystack confirms.",
        buttons: featuredProButtons(),
      },
    ],
    nextRole,
  );
}

function chooseProMethod(world: World, currency: Currency): ReduceResult {
  const amount = formatCharge(PRO_USD_CENTS, currency);
  return out(world, [
    {
      text: `Pro · ${amount} (${currency}).\n\nCard or bank transfer. I issue the ID after Paystack confirms.`,
      buttons: [
        [{ label: `Card · ${amount}`, payload: `propay:${currency}:card`, tone: "primary" }],
        [{ label: `Bank transfer · ${amount}`, payload: `propay:${currency}:transfer` }],
      ],
    },
  ]);
}

function payProTransfer(world: World, currency: Currency = "USD"): ReduceResult {
  const details = transferDetails(currency, PRO_USD_CENTS, "PRO-CREATOR");
  return out(world, [
    {
      text: `Bank transfer for Pro\n\n${details.text}\n\nSend the exact amount, then tap I've paid. The ID is issued after confirmation.`,
      buttons: [
        [{ label: "I've paid", payload: `propay:${currency}:transfer_done`, tone: "primary" }],
        [{ label: "Pay by card instead", payload: `propay:${currency}:card` }],
      ],
    },
  ]);
}

function studio(world: World): ReduceResult {
  const community = ownedCommunity(world);
  if (!community) return becomeCreator(world);
  const members = world.members.filter((m) => m.communityId === community.id);
  const active = members.filter((m) => m.status === "active").length;
  const pending = members.filter((m) => m.status === "pending").length;
  const pastDue = world.subscriptions.filter(
    (s) => s.communityId === community.id && s.status === "past_due",
  ).length;
  const dest = destinationFor(community);
  if (!dest) return out(world, attachAccountPrompt(community.code));
  const hasIbrahim = members.some((m) => m.username === "ibrahim_ngn");
  const extra: InlineBtn[] = hasIbrahim
    ? [{ label: "Fail @ibrahim card", payload: "fail:ibrahim_ngn", tone: "danger" }]
    : [];
  return out(world, [
    {
      text: `${community.name}\nCreator ID  ${community.code}\n\nTell customers: send ${community.code} or “${community.name}” to ${botMention()}\nThey pay in USD (or local) by card or transfer. They never see the split.\nAdd ${botMention()} as admin with Invite users and Ban users.\n\n${active} in the group · ${pending} waiting · ${pastDue} past due\nYour share → ${dest}\nPlatform fee → operator Telegram wallet\n${community.platformPlan} · ${feePct(community.feeBps)} fee\n\nThe money loop runs on a server cron. /loop is a manual override.`,
      buttons: [
        [
          { label: "Copy ID", payload: "link" },
          { label: "Members", payload: "members" },
        ],
        [
          { label: "Plans", payload: "plans_owner" },
          { label: "Account", payload: "payout" },
        ],
        [
          { label: "Kick non-renewals now", payload: "loop", tone: "primary" },
          { label: "Moderation", payload: "moderation" },
        ],
        [{ label: "Your take", payload: "earnings" }, ...extra],
      ],
    },
  ]);
}

function requireOwner(world: World) {
  return ownedCommunity(world) ?? null;
}

function notCreator(world: World): ReduceResult {
  return out(world, [
    {
      text: "That command is for creators who already have an ID. Tap I run a group to subscribe, or walk Adaeze’s desk to see a live group.",
      buttons: [
        [
          { label: "I run a group", payload: "become_creator", tone: "primary" },
          { label: "Walk Adaeze’s desk", payload: "as_adaeze" },
        ],
      ],
    },
  ]);
}

function status(world: World): ReduceResult {
  const community = requireOwner(world);
  if (!community) return notCreator(world);
  const members = world.members.filter((m) => m.communityId === community.id);
  const active = members.filter((m) => m.status === "active").length;
  const pending = members.filter((m) => m.status === "pending").length;
  const pastDue = world.subscriptions.filter(
    (s) => s.communityId === community.id && s.status === "past_due",
  ).length;
  return out(world, [
    {
      text: `${community.name}: ${active} in the group, ${pending} waiting, ${pastDue} past due.`,
      buttons: [
        [
          { label: "Members", payload: "members" },
          { label: "Run loop now", payload: "loop" },
        ],
      ],
    },
  ]);
}

function membersList(world: World): ReduceResult {
  const community = requireOwner(world);
  if (!community) return notCreator(world);
  const members = world.members
    .filter((m) => m.communityId === community.id)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const lines = members.map((m) => {
    const sub = world.subscriptions.find((s) => s.userId === m.userId && s.communityId === community.id);
    const plan = world.plans.find((p) => p.id === sub?.planId);
    const end = sub ? formatDate(sub.periodEnd) : "—";
    return `@${m.username}  ${m.status}${plan ? ` · ${plan.name}` : ""} · ${end}`;
  });
  const kickable = members.filter((m) => m.status === "active").slice(0, 4);
  return out(world, [
    {
      text: lines.join("\n") || "No members yet.",
      buttons: kickable.map((m) => [
        { label: `Kick @${m.username}`, payload: `kick:${m.username}`, tone: "danger" as const },
        { label: `+7d @${m.username}`, payload: `extend:${m.username}:7` },
      ]),
    },
  ]);
}

function ownerPlans(world: World): ReduceResult {
  const community = requireOwner(world);
  if (!community) return notCreator(world);
  const plans = plansFor(world, community.id);
  return out(world, [
    {
      text: plans.length ? plans.map(planLine).join("\n\n") : "No active plans. Set a monthly price first.",
      buttons: [[{ label: "New monthly plan", payload: "newplan", tone: "primary" }]],
    },
  ]);
}

function checkoutLink(world: World): ReduceResult {
  const community = requireOwner(world);
  if (!community) return notCreator(world);
  const dest = destinationFor(community);
  if (!dest) return out(world, attachAccountPrompt(community.code));
  return out(world, [
    {
      text: `Your creator ID is ${community.code}.\nGroup name is “${community.name}”.\nYour share → ${dest}.\n\nSend this to customers:\n\nsend ${community.code} to ${botMention()}\nor\nsend ${community.name} to ${botMention()}\n\nThey pay by card or bank transfer. I send the join link after Paystack confirms. They never see the split.`,
      buttons: [[{ label: "Open as a customer", payload: `community:${community.code}`, tone: "primary" }]],
    },
  ]);
}

function payout(world: World): ReduceResult {
  const community = requireOwner(world);
  if (!community) return notCreator(world);
  const dest = destinationFor(community);
  if (dest) {
    return out(world, [
      {
        text: `Account on ID ${community.code}\n${dest}\n\nYour share of every card or transfer on this ID settles here. The platform percentage credits the operator's Telegram wallet. Customers never see that split.\n\nTo change the account on this ID, pick a bank and send a new NUBAN.`,
        buttons: [[{ label: "Change account", payload: "payout_change" }, { label: "Studio", payload: "studio" }]],
      },
    ]);
  }
  return out(world, attachAccountPrompt(community.code));
}

function earnings(world: World): ReduceResult {
  const community = requireOwner(world);
  if (!community) return notCreator(world);
  const pays = world.payments.filter((p) => p.communityId === community.id && p.status === "success");
  const gross = pays.reduce((a, p) => a + p.amount, 0);
  const fee = pays.reduce((a, p) => a + p.platformFee, 0);
  const net = pays.reduce((a, p) => a + p.creatorPayout, 0);
  const last = pays.slice(0, 5).map((p) => {
    const plan = world.plans.find((x) => x.id === p.planId);
    return `${formatDate(p.createdAt)}  ${formatMoney(p.amount)}  ${providerLabel(p.provider)}  ${plan?.name ?? ""}`;
  });
  return out(world, [
    {
      text: `${community.name} earnings\nGross ${formatMoney(gross)}\nTo your bank  ${formatMoney(net)}\nTelegram wallet (operator)  ${formatMoney(fee)} (${feePct(community.feeBps)})\n\n${last.join("\n") || "No successful charges yet."}`,
      buttons: [[{ label: "Studio", payload: "studio" }]],
    },
  ]);
}

function yourTake(world: World): ReduceResult {
  if (world.role === "member" && world.actingAs === "self") {
    return out(world, [
      {
        text: "That’s for the person who owns this bot.",
        buttons: CUSTOMER_MAIN,
      },
    ]);
  }
  const snap = platformSnapshot(world);
  const rows = world.communities.map((c) => {
    const pays = world.payments.filter((p) => p.communityId === c.id && p.status === "success");
    const fee = pays.reduce((a, p) => a + p.platformFee, 0);
    const dest = destinationFor(c);
    const sub = c.platformPlan === "pro" ? " · $15/mo Pro" : "";
    return `${c.code}  ${c.name}\n${c.platformPlan}${sub} · wallet ${formatMoney(fee)}\n${dest ? `Creator bank ${dest}` : "No account attached"}`;
  });
  return out(world, [
    {
      text: `Your Telegram wallet\n\n${formatMoney(snap.cut)} from member fees\n$${snap.proUsd}.00 / mo from Pro creators\n\n${snap.creatorCount} creators on this bot · ${snap.pro} on Pro\nMember volume ${formatMoney(snap.gmv)}\n${snap.activeSeats} seats · ${snap.kicked} kicked\n\n${rows.join("\n\n") || "No creators yet."}\n\nThe percentage lands here, in your Telegram wallet. Creator share hits the account on their ID. Customers never see this split.`,
      buttons: [
        [
          { label: "Join a group", payload: "discover" },
          { label: "I run a group", payload: "become_creator", tone: "primary" },
        ],
      ],
    },
  ]);
}

function moderation(world: World): ReduceResult {
  const community = requireOwner(world);
  if (!community) return notCreator(world);
  const kws = world.keywords.filter((k) => k.communityId === community.id);
  const events = world.modEvents.filter((e) => e.communityId === community.id).slice(0, 4);
  const kwLines = kws.map((k) => `“${k.keyword}” → ${k.action}`).join("\n") || "No keyword filters.";
  const evLines = events.map((e) => `@${e.username} · ${e.classification} · ${e.action}\n${e.text}`).join("\n\n");
  return out(world, [
    {
      text: `Filters for ${community.name}\n${kwLines}\n\nRecent\n${evLines || "Quiet."}`,
      buttons: [
        [
          { label: "Add filter", payload: "filter_add" },
          { label: "Scan a message", payload: "scan" },
        ],
      ],
    },
  ]);
}

function loop(world: World): ReduceResult {
  const community = requireOwner(world);
  if (!community) return notCreator(world);
  return out(world, [
    {
      text: `Running the money loop on ${community.name} now (manual override). The same job runs on a server cron: retry, warn, then kick and revoke invite links.`,
    },
  ], {
    effects: [{ type: "run_loop" }],
  });
}

function failCard(world: World, username: string): ReduceResult {
  const community = requireOwner(world);
  if (!community) return notCreator(world);
  const handle = username.replace(/^@/, "").toLowerCase();
  const member = world.members.find(
    (m) => m.communityId === community.id && m.username.toLowerCase() === handle,
  );
  if (!member) return out(world, [{ text: `No member @${handle}.` }]);
  return out(world, [
    {
      text: `@${member.username}'s card will decline. The cron (or /loop) will retry, warn, then kick and revoke their invite.`,
      buttons: [[{ label: "Run money loop now", payload: "loop", tone: "primary" }]],
    },
  ], {
    effects: [
      { type: "fail_card", username: member.username },
      {
        type: "log",
        communityId: community.id,
        event: "warn",
        message: `@${member.username}'s card will decline. Run the money loop: retry → warn → kick.`,
      },
    ],
  });
}

function handlePending(world: World, text: string): ReduceResult {
  const pending = world.pending;
  if (!pending) return handleInput(world, text);
  if (text.toLowerCase() === "/cancel" || text.toLowerCase() === "cancel") {
    return out(world, [{ text: "Cancelled.", buttons: menu(world) }], { pending: null });
  }

  if (pending.kind === "await_nuban") {
    if (!isNuban(text)) return out(world, [{ text: "Enter a 10-digit NUBAN account number." }]);
    return out(world, [{ text: "Attaching that account to this ID." }], {
      pending: null,
      effects: [{ type: "connect_bank", bankCode: pending.bankCode, accountNumber: text }],
    });
  }
  if (pending.kind === "await_checkout_currency") {
    const ccy = parseCurrency(text);
    const plan = world.plans.find((p) => p.id === pending.planId);
    if (!ccy || !plan) {
      return out(world, [
        {
          text: "I don’t quote that currency yet. Try USD, EUR, GBP, NGN, GHS, KES — or tap More currencies.",
          buttons: plan
            ? featuredCheckoutButtons(plan.id, plan.priceUsd)
            : [[{ label: "Join a group", payload: "discover" }]],
        },
      ]);
    }
    return chooseMethod({ ...world, pending: null }, pending.planId, ccy);
  }
  if (pending.kind === "await_pro_currency") {
    const ccy = parseCurrency(text);
    if (!ccy) {
      return out(world, [
        {
          text: "I don’t quote that currency yet. Try USD, EUR, naira, yen — or tap More currencies.",
          buttons: featuredProButtons(),
        },
      ]);
    }
    return chooseProMethod({ ...world, pending: null }, ccy);
  }
  if (pending.kind === "await_community_name") {
    return out(world, [
      {
        text: `Got “${text.slice(0, 48)}”. Send the monthly price members will pay, in US dollars, digits only (e.g. 15).`,
      },
    ], {
      pending: {
        kind: "await_community_price",
        name: text.slice(0, 48),
        platformPlan: pending.platformPlan,
      },
    });
  }
  if (pending.kind === "await_community_price") {
    const dollars = parseInt(text.replace(/[^\d]/g, ""), 10);
    if (!dollars || dollars < 1) return out(world, [{ text: "Send a monthly price of at least 1 US dollar." }]);
    return out(world, [
      {
        text: `Got it. Members pay ${formatMoney(dollars * 100)} / month for “${pending.name}”.\n\nNow attach a bank account to this ID. Your share settles there. The platform percentage credits the operator Telegram wallet. Customers never see that split.\n\nPick the bank.`,
        buttons: bankButtons(),
      },
    ], {
      pending: {
        kind: "await_community_bank",
        name: pending.name,
        priceUsd: dollars * 100,
        platformPlan: pending.platformPlan,
      },
    });
  }
  if (pending.kind === "await_community_bank") {
    return out(world, attachAccountPrompt());
  }
  if (pending.kind === "await_community_nuban") {
    if (!isNuban(text)) return out(world, [{ text: "Enter a 10-digit NUBAN account number." }]);
    return out(world, [
      {
        text: `Issuing your creator ID and attaching that account. Add ${botMention()} as admin with Invite users and Ban users.`,
      },
    ], {
      pending: null,
      effects: [
        {
          type: "create_community",
          name: pending.name,
          priceUsd: pending.priceUsd,
          platformPlan: pending.platformPlan,
          bankCode: pending.bankCode,
          accountNumber: text,
        },
      ],
    });
  }
  if (pending.kind === "await_plan_name") {
    return out(world, [{ text: `Price for ${text.slice(0, 32)} in US dollars, digits only (e.g. 15).` }], {
      pending: { kind: "await_plan_price", name: text.slice(0, 32) },
    });
  }
  if (pending.kind === "await_plan_price") {
    const dollars = parseInt(text.replace(/[^\d]/g, ""), 10);
    if (!dollars || dollars < 1) return out(world, [{ text: "Send at least 1 US dollar." }]);
    return out(world, [{ text: `Publishing ${pending.name} at ${formatMoney(dollars * 100)} / month.` }], {
      pending: null,
      effects: [{ type: "add_plan", name: pending.name, priceUsd: dollars * 100 }],
    });
  }
  if (pending.kind === "await_kick") {
    return out(world, [{ text: `Kicking ${text}.` }], {
      pending: null,
      effects: [{ type: "kick", username: text }],
    });
  }
  if (pending.kind === "await_extend_user") {
    return out(world, [{ text: "How many days? (1–365)" }], {
      pending: { kind: "await_extend_days", username: text.replace(/^@/, "") },
    });
  }
  if (pending.kind === "await_extend_days") {
    const days = Math.max(1, Math.min(365, parseInt(text, 10) || 7));
    return out(world, [{ text: `Extending @${pending.username} by ${days} days.` }], {
      pending: null,
      effects: [{ type: "extend", username: pending.username, days }],
    });
  }
  if (pending.kind === "await_filter") {
    const keyword = text.trim().toLowerCase();
    return out(world, [
      {
        text: `Filter added: “${keyword}” → remove.`,
        buttons: [[{ label: "Moderation", payload: "moderation" }]],
      },
    ], {
      pending: null,
      effects: [{ type: "add_filter", keyword, action: "remove" }],
    });
  }
  if (pending.kind === "await_scan") {
    return out(world, [{ text: "Scanning." }], {
      pending: null,
      effects: [{ type: "scan", text }],
    });
  }
  return out(world, [{ text: "Cancelled.", buttons: MAIN }], { pending: null });
}

export function handleInput(world: World, raw: string): ReduceResult {
  const text = raw.trim();
  if (!text) return out(world, []);
  if (world.pending) return handlePending(world, text);

  const chip: Record<string, string> = {
    Discover: "discover",
    "Join a group": "discover",
    "My seats": "my",
    "Creator studio": "studio",
    Studio: "studio",
    Help: "help",
    "How it works": "help",
    "I run a group": "become_creator",
    "Your take": "take",
  };
  if (chip[text]) return handleCallback(world, chip[text]);

  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(" ").trim();
  const c = (cmd ?? "").toLowerCase();

  if (c === "/start" || c === "start") return out(world, startWelcome());
  if (c === "/help" || c === "help") return help(world);
  if (c === "/discover" || c === "discover") return discover(world);
  if (c === "/my" || c === "my") return mySeats(world);
  if (c === "/studio" || c === "studio") return studio(world);
  if (c === "/id" || c === "/link") return checkoutLink(world);
  if (c === "/status") return status(world);
  if (c === "/members") return membersList(world);
  if (c === "/plan" || c === "/plans") return ownedCommunity(world) ? ownerPlans(world) : discover(world);
  if (c === "/payout") return payout(world);
  if (c === "/earnings") return earnings(world);
  if (c === "/take") return yourTake(world);
  if (c === "/moderation") return moderation(world);
  if (c === "/loop") return loop(world);
  if (c === "/join") {
    if (arg) return showCommunity(world, arg.replace(/^\//, ""));
    return discover(world);
  }
  if (c.startsWith("/") && publicCommunities(world).some((x) => `/${x.slug}` === c || `/${x.code.toLowerCase()}` === c)) {
    return showCommunity(world, c.slice(1));
  }
  if (c === "/kick") {
    if (!arg) {
      return out(world, [{ text: "Tag a member to kick, e.g. /kick ibrahim_ngn" }], {
        pending: { kind: "await_kick" },
      });
    }
    return out(world, [{ text: `Kicking ${arg}.` }], { effects: [{ type: "kick", username: arg }] });
  }
  if (c === "/extend") {
    const [user, daysRaw] = rest;
    if (!user) {
      return out(world, [{ text: "Who should I extend? Send a username." }], {
        pending: { kind: "await_extend_user" },
      });
    }
    const days = Math.max(1, Math.min(365, parseInt(daysRaw ?? "7", 10) || 7));
    return out(world, [{ text: `Extending ${user} by ${days} days.` }], {
      effects: [{ type: "extend", username: user, days }],
    });
  }
  if (c === "/fail" && arg) return failCard(world, arg);
  if (c === "/newplan") {
    return out(world, [{ text: "Name the plan (for example Premium)." }], {
      pending: { kind: "await_plan_name" },
    });
  }

  const hit = communityBySlug(world, text.replace(/^\//, ""));
  if (hit) return showCommunity(world, hit.code);

  return out(world, [
    {
      text: "Send a creator ID or group name to join (try LA-ADA or Lagos Alpha), or tap I run a group to buy an ID.",
      buttons: menu(world),
    },
  ]);
}

export function handleCallback(world: World, payload: string): ReduceResult {
  if (payload === "discover") return discover(world);
  if (payload === "my") return mySeats(world);
  if (payload === "help") return help(world);
  if (payload === "studio") return studio(world);
  if (payload === "become_creator") return becomeCreator(world);
  if (payload === "creator_plan:trial") return startCreatorPlan(world, "trial");
  if (payload === "creator_plan:pro" || payload === "pro_pay") return payPro(world);
  if (payload === "promore") {
    return out(world, [
      {
        text: "More currencies for Pro. Dollar is still the list price.",
        buttons: [
          ...pairCurrencyButtons(PRO_USD_CENTS, MORE_CURRENCIES, (code) => `proccy:${code}`),
          [{ label: "Back", payload: "pro_pay" }],
        ],
      },
    ]);
  }
  if (payload === "prototype") {
    return out(world, [{ text: "Send a currency code or name — USD, EUR, naira, yen, rand…" }], {
      pending: { kind: "await_pro_currency" },
    });
  }
  if (payload === "status") return status(world);
  if (payload === "members") return membersList(world);
  if (payload === "plans_owner") return ownerPlans(world);
  if (payload === "link") return checkoutLink(world);
  if (payload === "payout") return payout(world);
  if (payload === "payout_change") return out(world, attachAccountPrompt(ownedCommunity(world)?.code));
  if (payload === "earnings") return earnings(world);
  if (payload === "take") return yourTake(world);
  if (payload === "moderation") return moderation(world);
  if (payload === "loop") return loop(world);
  if (payload === "cancel") {
    return out(world, [{ text: "Cancelled.", buttons: menu(world) }], { pending: null });
  }
  if (payload === "as_adaeze") {
    const next = { ...world, role: "creator" as const, actingAs: "adaeze" as const };
    return studio(next);
  }
  if (payload === "as_creator") return becomeCreator(world);
  if (payload === "as_member") {
    const next = { ...world, role: "member" as const, actingAs: "self" as const, pending: null };
    return out(next, startWelcome(), { role: "member", actingAs: "self", pending: null });
  }
  if (payload === "why_cards") {
    return out(world, [
      {
        text: "Checkout opens after the creator attaches a bank account to their ID. Customers then pay by card or bank transfer in USD or another listed currency. The join link is minted only after Paystack charge.success.",
        buttons: [[{ label: "Join a group", payload: "discover" }]],
      },
    ]);
  }
  if (payload === "newplan") {
    return out(world, [{ text: "Name the plan (for example Premium)." }], {
      pending: { kind: "await_plan_name" },
    });
  }
  if (payload === "filter_add") {
    return out(world, [{ text: "Send the keyword to remove on sight." }], {
      pending: { kind: "await_filter" },
    });
  }
  if (payload === "scan") {
    return out(world, [{ text: "Paste a group message. I’ll classify it (keyword first, then heuristics)." }], {
      pending: { kind: "await_scan" },
    });
  }
  if (payload.startsWith("community:")) return showCommunity(world, payload.slice("community:".length));
  if (payload.startsWith("plan:")) return showPlan(world, payload.slice("plan:".length));
  if (payload.startsWith("moreccy:")) {
    const planId = payload.slice("moreccy:".length);
    const plan = world.plans.find((p) => p.id === planId);
    if (!plan) return out(world, [{ text: "Plan not found." }]);
    return out(world, [
      {
        text: `${plan.name} · more currencies. Dollar is still the list price.`,
        buttons: moreCheckoutButtons(plan.id, plan.priceUsd),
        kind: "invoice",
      },
    ]);
  }
  if (payload.startsWith("typeccy:")) {
    const planId = payload.slice("typeccy:".length);
    const plan = world.plans.find((p) => p.id === planId);
    if (!plan) return out(world, [{ text: "Plan not found." }]);
    return out(world, [{ text: "Send a currency code or name — USD, EUR, naira, yen, rand, cedi…" }], {
      pending: { kind: "await_checkout_currency", planId },
    });
  }
  if (payload.startsWith("ccy:")) {
    const [, planId, ccy] = payload.split(":");
    if (!planId || !ccy || !isCurrency(ccy)) return out(world, [{ text: "Pick a currency." }]);
    return chooseMethod(world, planId, ccy);
  }
  if (payload.startsWith("paid:")) {
    const [, planId, ccy] = payload.split(":");
    if (!planId || !ccy || !isCurrency(ccy)) return out(world, [{ text: "Bad payment payload." }]);
    return checkout(world, planId, "transfer", ccy);
  }
  if (payload.startsWith("pay:")) {
    const [, planId, ccy, method] = payload.split(":");
    if (!planId || !ccy || !isCurrency(ccy)) return out(world, [{ text: "Bad payment payload." }]);
    if (method === "transfer") return showTransfer(world, planId, ccy);
    return checkout(world, planId, "card", ccy);
  }
  if (payload.startsWith("proccy:")) {
    const ccy = payload.slice("proccy:".length);
    if (!isCurrency(ccy)) return out(world, [{ text: "Pick a currency." }]);
    return chooseProMethod(world, ccy);
  }
  if (payload.startsWith("propay:")) {
    const parts = payload.split(":");
    const ccy = (parts[1] && isCurrency(parts[1]) ? parts[1] : "USD") as Currency;
    const method = parts[2] ?? parts[1];
    if (method === "transfer") return payProTransfer(world, ccy);
    return out(world, [{ text: "Opening Pro checkout." }], {
      pending: null,
      role: "creator",
      actingAs: "self",
      effects: [{ type: "checkout_pro", currency: ccy, provider: method === "transfer_done" ? "transfer" : "card" }],
    });
  }
  if (payload.startsWith("simcharge:")) {
    const reference = payload.slice("simcharge:".length);
    if (!reference) return out(world, [{ text: "Missing payment reference." }]);
    return out(world, [], { effects: [{ type: "fulfill", reference }] });
  }
  if (payload.startsWith("openchat:")) {
    return out(world, [], { effects: [{ type: "open_chat", chatId: payload.slice("openchat:".length) }] });
  }
  if (payload.startsWith("kick:")) {
    return out(world, [{ text: `Kicking ${payload.slice("kick:".length)}.` }], {
      effects: [{ type: "kick", username: payload.slice("kick:".length) }],
    });
  }
  if (payload.startsWith("extend:")) {
    const [, user, days] = payload.split(":");
    if (!user) return out(world, [{ text: "Tag a member." }]);
    return out(world, [{ text: `Extending @${user}.` }], {
      effects: [{ type: "extend", username: user, days: parseInt(days ?? "7", 10) || 7 }],
    });
  }
  if (payload.startsWith("bank:")) {
    const code = payload.slice("bank:".length);
    const current = world.pending;
    const bank = NG_BANKS.find((b) => b.code === code);
    if (current?.kind === "await_community_bank") {
      return out(world, [
        {
          text: `${bank?.name ?? "Bank"} will be attached to this ID. Member money for this ID will settle there. Send the 10-digit NUBAN.`,
        },
      ], {
        pending: {
          kind: "await_community_nuban",
          name: current.name,
          priceUsd: current.priceUsd,
          platformPlan: current.platformPlan,
          bankCode: code,
        },
      });
    }
    return out(world, [
      {
        text: `${bank?.name ?? "Bank"} selected for this ID. Send the 10-digit NUBAN. Member money for this ID will go there.`,
      },
    ], { pending: { kind: "await_nuban", bankCode: code } });
  }
  if (payload.startsWith("fail:")) return failCard(world, payload.slice("fail:".length));
  return handleInput(world, payload);
}

/** Pure bot FSM. No Zustand, no React, no I/O. */
export function reduce(world: World, event: BotEvent): ReduceResult {
  if (event.type === "input") return handleInput(world, event.text);
  return handleCallback(world, event.payload);
}

export { MAIN, CUSTOMER_MAIN, PRO_USD_CENTS };
