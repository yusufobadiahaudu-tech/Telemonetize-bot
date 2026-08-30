import { NG_BANKS, isNuban } from "@/lib/banks";
import { BOT_CHAT_ID } from "@/lib/constants";
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
import { useApp } from "@/lib/store";
import type { InlineBtn, Plan, Provider } from "@/lib/types";

type Reply = { text: string; buttons?: InlineBtn[][]; kind?: "text" | "receipt" | "invite" | "invoice" };

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

function menu(): InlineBtn[][] {
  const { role, actingAs } = useApp.getState();
  return role === "member" && actingAs === "self" ? CUSTOMER_MAIN : MAIN;
}

function send(replies: Reply[]) {
  const { pushBot } = useApp.getState();
  for (const r of replies) pushBot(r.text, r.buttons, r.kind);
}

function bankButtons(): InlineBtn[][] {
  return NG_BANKS.slice(0, 10).map((b) => [{ label: b.name, payload: `bank:${b.code}` }]);
}

function attachAccountPrompt(code?: string): Reply[] {
  const who = code ? `ID ${code}` : "this ID";
  return [
    {
      text: `Attach a bank account to ${who}.\n\nEvery card payment on ${who} settles to that account. TeleMonetize only keeps its fee. We never hold the rest.\n\nPick the bank, then send the 10-digit NUBAN.`,
      buttons: bankButtons(),
    },
  ];
}

function publicCommunities() {
  return useApp.getState().communities.filter((c) => c.isPublic);
}

function plansFor(communityId: string) {
  return useApp
    .getState()
    .plans.filter((p) => p.communityId === communityId && p.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
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

function requireOwner() {
  const { ownedCommunity } = useApp.getState();
  return ownedCommunity() ?? null;
}

export function startWelcome(): Reply[] {
  return [
    {
      text: "You own this bot.\n\nCreators subscribe and get an ID — like LA-ADA. They bind a group name and a bank account to that ID. Member money for the ID goes to that account. Your percentage credits your Telegram wallet.\n\nCustomers send the ID or the group name. They pay in dollars — or another currency — by card or bank transfer. I send the join link. They never see the split.\n\nIf they do not renew, I kick them.",
      buttons: MAIN,
    },
  ];
}

export function handleHelp(): Reply[] {
  const { role, actingAs } = useApp.getState();
  if (role === "member" && actingAs === "self") {
    return [
      {
        text: "Send a creator ID or the group name. Try LA-ADA or Lagos Alpha.\n\nPick a plan. Dollar is the list price. Pay in USD, or another currency, by card or bank transfer. I send a one-time join link.\n\nAlready in? /my",
        buttons: CUSTOMER_MAIN,
      },
    ];
  }
  return [
    {
      text: "How you make money from creators\n\n1. Mr. A taps I run a group and subscribes — trial at 8%, or Pro $15/month at 5%. He pays Pro by card or bank transfer, in USD or another currency.\n2. I issue a creator ID (LA-ADA). He binds his group name and a bank account to that ID.\n3. Customers send LA-ADA — or the group name — to @TeleMonetizeBot.\n4. They pay in dollars first, or any other listed currency, by card or bank transfer. I send a join link. They never see how the money is shared.\n5. Your percentage credits your Telegram wallet. Their share hits the account on that ID. I kick anyone who does not renew.\n\nCustomers: send a creator ID or a group name. Try LA-ADA or Lagos Alpha.\nCreators: /studio  /id  /payout  /kick @user  /loop\nYou: /take",
      buttons: MAIN,
    },
  ];
}

function discover(): Reply[] {
  useApp.getState().setRole("member");
  useApp.getState().setActingAs("self");
  const rows = publicCommunities();
  const lines = rows.map((c) => {
    const plans = plansFor(c.id);
    const low = plans[0];
    const n = useApp.getState().members.filter((m) => m.communityId === c.id && m.status === "active").length;
    const price = low ? `from ${formatMoney(low.priceUsd)} / ${intervalLabel(low.interval)}` : "no plans";
    return `${c.code}  ·  ${c.name}\n${c.bio}\n${n} in the room · ${price}\nTell people: send ${c.code} or “${c.name}” to @TeleMonetizeBot`;
  });
  return [
    {
      text: `Send a creator ID or the group name.\n\n${lines.join("\n\n") || "No public groups yet."}`,
      buttons: rows.map((c) => [
        { label: `${c.code} · ${c.name}`, payload: `community:${c.code}`, tone: "primary" as const },
      ]),
    },
  ];
}

function showCommunity(slug: string): Reply[] {
  const c = useApp.getState().communityBySlug(slug);
  if (!c) {
    return [{ text: "No creator with that ID or group name. Send LA-ADA or Lagos Alpha, or tap Join a group." }];
  }
  const plans = plansFor(c.id);
  const n = useApp.getState().members.filter((m) => m.communityId === c.id && m.status === "active").length;
  return [
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
  ];
}

function showPlan(planId: string): Reply[] {
  const plan = useApp.getState().plans.find((p) => p.id === planId);
  if (!plan) return [{ text: "Plan not found." }];
  const c = useApp.getState().communities.find((x) => x.id === plan.communityId);
  if (!c) return [{ text: "Community not found." }];
  if (!c.payoutConnected) {
    return [
      {
        text: `${c.name} · ${plan.name}\nCheckout is not open yet. Try another group, or check back shortly.`,
        buttons: [[{ label: "Join a group", payload: "discover" }]],
      },
    ];
  }
  const buttons = featuredCheckoutButtons(plan.id, plan.priceUsd);
  return [
    {
      text: `${c.name} · ${plan.name}\n${plan.description}\n\n${formatMoney(plan.priceUsd)} / ${intervalLabel(plan.interval)}\n\nDollar is the list price. Pay in USD, or pick another currency.`,
      buttons,
      kind: "invoice",
    },
  ];
}

function chooseMethod(planId: string, currency: Currency): Reply[] {
  const plan = useApp.getState().plans.find((p) => p.id === planId);
  if (!plan) return [{ text: "Plan not found." }];
  const amount = formatCharge(plan.priceUsd, currency);
  return [
    {
      text: `Pay ${amount} (${currency}).\n\nCard or bank transfer.`,
      buttons: [
        [{ label: `Card · ${amount}`, payload: `pay:${plan.id}:${currency}:card`, tone: "primary" }],
        [{ label: `Bank transfer · ${amount}`, payload: `pay:${plan.id}:${currency}:transfer` }],
      ],
      kind: "invoice",
    },
  ];
}

function showTransfer(planId: string, currency: Currency): Reply[] {
  const plan = useApp.getState().plans.find((p) => p.id === planId);
  if (!plan) return [{ text: "Plan not found." }];
  const community = useApp.getState().communities.find((x) => x.id === plan.communityId);
  if (!community) return [{ text: "Community not found." }];
  const me = useApp.getState().me();
  const ref = `${community.code}-${me.username}`.replace(/[^A-Z0-9-]/gi, "").slice(0, 18).toUpperCase();
  const details = transferDetails(currency, plan.priceUsd, ref);
  return [
    {
      text: `Bank transfer\n${community.name} · ${plan.name}\n\n${details.text}\n\nSend the exact amount, then tap I've paid.`,
      buttons: [
        [{ label: "I've paid", payload: `paid:${plan.id}:${currency}:transfer`, tone: "primary" }],
        [{ label: "Pay by card instead", payload: `pay:${plan.id}:${currency}:card` }],
      ],
      kind: "invoice",
    },
  ];
}

function pay(planId: string, provider: Provider, currency: Currency): Reply[] {
  const result = useApp.getState().subscribe(planId, provider, currency);
  if (!result.ok) return [{ text: result.error, buttons: CUSTOMER_MAIN }];
  const { community, plan, inviteUrl } = result;
  return [
    {
      text: `Payment received.\n\n${community.name} · ${plan.name}\n${formatCharge(plan.priceUsd, currency)} via ${providerLabel(provider)}\n\nYou're in. Tap to join the ${community.chatType}:\n${inviteUrl}`,
      buttons: [
        [{ label: `Open ${community.name}`, payload: `openchat:${community.chatId}`, tone: "primary" }],
        [{ label: "My seats", payload: "my" }],
      ],
      kind: "receipt",
    },
  ];
}

function mySeats(): Reply[] {
  const seats = useApp.getState().mySeats();
  if (!seats.length) {
    return [
      {
        text: "No seats yet. Pay on a community and I send the invite here.",
        buttons: [[{ label: "Join a group", payload: "discover", tone: "primary" }]],
      },
    ];
  }
  const lines = seats.map(({ community, plan, sub, member }) => {
    const end = sub ? relativeTime(sub.periodEnd) : "—";
    const st = sub?.status ?? member.status;
    return `${community.name} · ${plan?.name ?? "seat"}\n${st.replace("_", " ")} · ends ${end}`;
  });
  return [
    {
      text: lines.join("\n\n"),
      buttons: seats.map((s) => [
        { label: s.community.name, payload: `openchat:${s.community.chatId}`, tone: "primary" as const },
      ]),
    },
  ];
}

function becomeCreator(): Reply[] {
  const { setRole, setActingAs, ownedCommunity } = useApp.getState();
  setActingAs("self");
  setRole("creator");
  const community = ownedCommunity();
  if (community) return studio();
  return [
    {
      text: "Creators subscribe to this bot. Then they get an ID.\n\nTrial — 14 days free. 8% of each member payment credits the operator Telegram wallet.\nPro — $15 / month by card or bank transfer, in USD or another currency. 5% of each member payment.\n\nAfter they pay, they bind a group name and a bank account to the ID. Their share hits that account. Customers pay in any listed currency by card or transfer, and never see the split.",
      buttons: [
        [{ label: "Start 14-day trial", payload: "creator_plan:trial", tone: "primary" }],
        [{ label: "Pay Pro · $15 / month", payload: "pro_pay" }],
        [{ label: "Walk Adaeze’s desk (demo)", payload: "as_adaeze" }],
      ],
    },
  ];
}

function startCreatorPlan(plan: "trial" | "pro"): Reply[] {
  useApp.getState().setRole("creator");
  useApp.getState().setActingAs("self");
  if (useApp.getState().ownedCommunity()) return studio();
  useApp.getState().setPending({ kind: "await_community_name", platformPlan: plan });
  const paid =
    plan === "pro"
      ? "Pro is live. $15 received. 5% of each member payment will credit the operator Telegram wallet.\n\n"
      : "Trial is on. 8% of each member payment will credit the operator Telegram wallet.\n\n";
  return [
    {
      text: `${paid}Send the Telegram group name you want bound to your ID (for example “Lagos Desk”).`,
      buttons: [[{ label: "Cancel", payload: "cancel" }]],
    },
  ];
}

function payPro(): Reply[] {
  useApp.getState().setRole("creator");
  useApp.getState().setActingAs("self");
  if (useApp.getState().ownedCommunity()) return studio();
  return [
    {
      text: "Pro is $15 / month. Dollar is the list price. Pay in USD, or pick another currency — then card or bank transfer.",
      buttons: featuredProButtons(),
    },
  ];
}

function chooseProMethod(currency: Currency): Reply[] {
  const amount = formatCharge(PRO_USD_CENTS, currency);
  return [
    {
      text: `Pro · ${amount} (${currency}).\n\nCard or bank transfer.`,
      buttons: [
        [{ label: `Card · ${amount}`, payload: `propay:${currency}:card`, tone: "primary" }],
        [{ label: `Bank transfer · ${amount}`, payload: `propay:${currency}:transfer` }],
      ],
    },
  ];
}

function payProTransfer(currency: Currency = "USD"): Reply[] {
  const details = transferDetails(currency, PRO_USD_CENTS, "PRO-CREATOR");
  return [
    {
      text: `Bank transfer for Pro\n\n${details.text}\n\nSend the exact amount, then tap I've paid.`,
      buttons: [
        [{ label: "I've paid", payload: `propay:${currency}:card`, tone: "primary" }],
        [{ label: "Pay by card instead", payload: `propay:${currency}:card` }],
      ],
    },
  ];
}

function studio(): Reply[] {
  const { ownedCommunity } = useApp.getState();
  const community = ownedCommunity();
  if (!community) return becomeCreator();
  const members = useApp.getState().members.filter((m) => m.communityId === community.id);
  const active = members.filter((m) => m.status === "active").length;
  const pending = members.filter((m) => m.status === "pending").length;
  const pastDue = useApp
    .getState()
    .subscriptions.filter((s) => s.communityId === community.id && s.status === "past_due").length;
  const dest = destinationFor(community);
  if (!dest) return attachAccountPrompt(community.code);
  const bank = dest;
  const hasIbrahim = members.some((m) => m.username === "ibrahim_ngn");
  const extra: InlineBtn[] = hasIbrahim
    ? [{ label: "Fail @ibrahim card", payload: "fail:ibrahim_ngn", tone: "danger" }]
    : [];
  return [
    {
      text: `${community.name}\nCreator ID  ${community.code}\n\nTell customers: send ${community.code} or “${community.name}” to @TeleMonetizeBot\nThey pay in USD (or local) by card or transfer. They never see the split.\n\n${active} in the group · ${pending} waiting · ${pastDue} past due\nYour share → ${bank}\nPlatform fee → operator Telegram wallet\n${community.platformPlan} · ${feePct(community.feeBps)} fee`,
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
          { label: "Kick non-renewals", payload: "loop", tone: "primary" },
          { label: "Moderation", payload: "moderation" },
        ],
        [{ label: "Your take", payload: "earnings" }, ...extra],
      ],
    },
  ];
}

function status(): Reply[] {
  const community = requireOwner();
  if (!community) return notCreator();
  const members = useApp.getState().members.filter((m) => m.communityId === community.id);
  const active = members.filter((m) => m.status === "active").length;
  const pending = members.filter((m) => m.status === "pending").length;
  const pastDue = useApp
    .getState()
    .subscriptions.filter((s) => s.communityId === community.id && s.status === "past_due").length;
  return [
    {
      text: `${community.name}: ${active} in the group, ${pending} waiting, ${pastDue} past due.`,
      buttons: [
        [
          { label: "Members", payload: "members" },
          { label: "Run loop", payload: "loop" },
        ],
      ],
    },
  ];
}

function membersList(): Reply[] {
  const community = requireOwner();
  if (!community) return notCreator();
  const members = useApp
    .getState()
    .members.filter((m) => m.communityId === community.id)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const lines = members.map((m) => {
    const sub = useApp.getState().subscriptions.find((s) => s.userId === m.userId && s.communityId === community.id);
    const plan = useApp.getState().plans.find((p) => p.id === sub?.planId);
    const end = sub ? formatDate(sub.periodEnd) : "—";
    return `@${m.username}  ${m.status}${plan ? ` · ${plan.name}` : ""} · ${end}`;
  });
  const kickable = members.filter((m) => m.status === "active").slice(0, 4);
  return [
    {
      text: lines.join("\n") || "No members yet.",
      buttons: kickable.map((m) => [
        { label: `Kick @${m.username}`, payload: `kick:${m.username}`, tone: "danger" as const },
        { label: `+7d @${m.username}`, payload: `extend:${m.username}:7` },
      ]),
    },
  ];
}

function ownerPlans(): Reply[] {
  const community = requireOwner();
  if (!community) return notCreator();
  const plans = plansFor(community.id);
  return [
    {
      text: plans.length ? plans.map(planLine).join("\n\n") : "No active plans. Set a monthly price first.",
      buttons: [[{ label: "New monthly plan", payload: "newplan", tone: "primary" }]],
    },
  ];
}

function checkoutLink(): Reply[] {
  const community = requireOwner();
  if (!community) return notCreator();
  const dest = destinationFor(community);
  if (!dest) return attachAccountPrompt(community.code);
  return [
    {
      text: `Your creator ID is ${community.code}.\nGroup name is “${community.name}”.\nYour share → ${dest}.\n\nSend this to customers:\n\nsend ${community.code} to @TeleMonetizeBot\nor\nsend ${community.name} to @TeleMonetizeBot\n\nThey pay by card or bank transfer. I send the join link. They never see the split.`,
      buttons: [[{ label: "Open as a customer", payload: `community:${community.code}`, tone: "primary" }]],
    },
  ];
}

function payout(): Reply[] {
  const community = requireOwner();
  if (!community) return notCreator();
  const dest = destinationFor(community);
  if (dest) {
    return [
      {
        text: `Account on ID ${community.code}\n${dest}\n\nYour share of every card or transfer on this ID settles here. The platform percentage credits the operator's Telegram wallet. Customers never see that split.\n\nTo change the account on this ID, pick a bank and send a new NUBAN.`,
        buttons: [[{ label: "Change account", payload: "payout_change" }, { label: "Studio", payload: "studio" }]],
      },
    ];
  }
  return attachAccountPrompt(community.code);
}

function earnings(): Reply[] {
  const community = requireOwner();
  if (!community) return notCreator();
  const pays = useApp
    .getState()
    .payments.filter((p) => p.communityId === community.id && p.status === "success");
  const gross = pays.reduce((a, p) => a + p.amount, 0);
  const fee = pays.reduce((a, p) => a + p.platformFee, 0);
  const net = pays.reduce((a, p) => a + p.creatorPayout, 0);
  const last = pays.slice(0, 5).map((p) => {
    const plan = useApp.getState().plans.find((x) => x.id === p.planId);
    return `${formatDate(p.createdAt)}  ${formatMoney(p.amount)}  ${providerLabel(p.provider)}  ${plan?.name ?? ""}`;
  });
  return [
    {
      text: `${community.name} earnings\nGross ${formatMoney(gross)}\nTo your bank  ${formatMoney(net)}\nTelegram wallet (operator)  ${formatMoney(fee)} (${feePct(community.feeBps)})\n\n${last.join("\n") || "No successful charges yet."}`,
      buttons: [[{ label: "Studio", payload: "studio" }]],
    },
  ];
}

function yourTake(): Reply[] {
  const { role, actingAs } = useApp.getState();
  if (role === "member" && actingAs === "self") {
    return [
      {
        text: "That’s for the person who owns this bot.",
        buttons: CUSTOMER_MAIN,
      },
    ];
  }
  const snap = platformSnapshot(useApp.getState());
  const rows = useApp.getState().communities.map((c) => {
    const pays = useApp.getState().payments.filter((p) => p.communityId === c.id && p.status === "success");
    const fee = pays.reduce((a, p) => a + p.platformFee, 0);
    const dest = destinationFor(c);
    const sub = c.platformPlan === "pro" ? " · $15/mo Pro" : "";
    return `${c.code}  ${c.name}\n${c.platformPlan}${sub} · wallet ${formatMoney(fee)}\n${dest ? `Creator bank ${dest}` : "No account attached"}`;
  });
  return [
    {
      text: `Your Telegram wallet\n\n${formatMoney(snap.cut)} from member fees\n$${snap.proUsd}.00 / mo from Pro creators\n\n${snap.creatorCount} creators on this bot · ${snap.pro} on Pro\nMember volume ${formatMoney(snap.gmv)}\n${snap.activeSeats} seats · ${snap.kicked} kicked\n\n${rows.join("\n\n") || "No creators yet."}\n\nThe percentage lands here, in your Telegram wallet. Creator share hits the account on their ID. Customers never see this split.`,
      buttons: [
        [
          { label: "Join a group", payload: "discover" },
          { label: "I run a group", payload: "become_creator", tone: "primary" },
        ],
      ],
    },
  ];
}

function moderation(): Reply[] {
  const community = requireOwner();
  if (!community) return notCreator();
  const kws = useApp.getState().keywords.filter((k) => k.communityId === community.id);
  const events = useApp.getState().modEvents.filter((e) => e.communityId === community.id).slice(0, 4);
  const kwLines = kws.map((k) => `“${k.keyword}” → ${k.action}`).join("\n") || "No keyword filters.";
  const evLines = events
    .map((e) => `@${e.username} · ${e.classification} · ${e.action}\n${e.text}`)
    .join("\n\n");
  return [
    {
      text: `Filters for ${community.name}\n${kwLines}\n\nRecent\n${evLines || "Quiet."}`,
      buttons: [
        [
          { label: "Add filter", payload: "filter_add" },
          { label: "Scan a message", payload: "scan" },
        ],
      ],
    },
  ];
}

function loop(): Reply[] {
  const community = requireOwner();
  if (!community) return notCreator();
  const r = useApp.getState().runLoop();
  return [
    {
      text: `Money loop on ${community.name}\n${r.renewed} renewed\n${r.retried} retried\n${r.warned} warned in Telegram\n${r.expired} expired\n${r.kicked} kicked\n${r.reminded} reminded (3-day)\n\nRetry. Warn. Then kick. No spreadsheet.`,
      buttons: [
        [
          { label: "Members", payload: "members" },
          { label: "Status", payload: "status" },
        ],
      ],
    },
  ];
}

function notCreator(): Reply[] {
  return [
    {
      text: "That command is for creators who already have an ID. Tap I run a group to subscribe, or walk Adaeze’s desk to see a live group.",
      buttons: [
        [
          { label: "I run a group", payload: "become_creator", tone: "primary" },
          { label: "Walk Adaeze’s desk", payload: "as_adaeze" },
        ],
      ],
    },
  ];
}

function failCard(username: string): Reply[] {
  const community = requireOwner();
  if (!community) return notCreator();
  const handle = username.replace(/^@/, "").toLowerCase();
  const member = useApp.getState().members.find(
    (m) => m.communityId === community.id && m.username.toLowerCase() === handle,
  );
  if (!member) return [{ text: `No member @${handle}.` }];
  useApp.setState((s) => ({
    subscriptions: s.subscriptions.map((sub) =>
      sub.communityId === community.id && sub.userId === member.userId
        ? {
            ...sub,
            cardFailing: true,
            autoRenew: true,
            periodEnd: new Date(Date.now() - 60_000).toISOString(),
          }
        : sub,
    ),
  }));
  useApp.getState().log(
    community.id,
    "warn",
    `@${member.username}'s card will decline. Run the money loop: retry → warn → kick.`,
  );
  return [
    {
      text: `@${member.username}'s card will decline. Run /loop: retry, warn in Telegram, then kick.`,
      buttons: [[{ label: "Run money loop", payload: "loop", tone: "primary" }]],
    },
  ];
}

export function handleInput(raw: string): Reply[] {
  const text = raw.trim();
  if (!text) return [];
  const { pending, setPending } = useApp.getState();

  if (pending) {
    return handlePending(text, pending);
  }

  if (
    text === "Discover" ||
    text === "My seats" ||
    text === "Creator studio" ||
    text === "Help" ||
    text === "Join a group" ||
    text === "I run a group" ||
    text === "How it works" ||
    text === "Studio" ||
    text === "Your take"
  ) {
    const map: Record<string, string> = {
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
    return handleCallback(map[text] ?? "help");
  }

  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(" ").trim();
  const c = (cmd ?? "").toLowerCase();

  if (c === "/start" || c === "start") return startWelcome();
  if (c === "/help" || c === "help") return handleHelp();
  if (c === "/discover" || c === "discover") return discover();
  if (c === "/my" || c === "my") return mySeats();
  if (c === "/studio" || c === "studio") return studio();
  if (c === "/id" || c === "/link") return checkoutLink();
  if (c === "/status") return status();
  if (c === "/members") return membersList();
  if (c === "/plan" || c === "/plans") return useApp.getState().ownedCommunity() ? ownerPlans() : discover();
  if (c === "/payout") return payout();
  if (c === "/earnings") return earnings();
  if (c === "/take") return yourTake();
  if (c === "/moderation") return moderation();
  if (c === "/loop") return loop();
  if (c === "/join") {
    if (arg) return showCommunity(arg.replace(/^\//, ""));
    return discover();
  }
  if (c.startsWith("/") && publicCommunities().some((x) => `/${x.slug}` === c || `/${x.code.toLowerCase()}` === c)) {
    return showCommunity(c.slice(1));
  }
  if (c === "/kick") {
    if (!arg) {
      setPending({ kind: "await_kick" });
      return [{ text: "Tag a member to kick, e.g. /kick ibrahim_ngn" }];
    }
    return [{ text: useApp.getState().kick(arg) }];
  }
  if (c === "/extend") {
    const [user, daysRaw] = rest;
    if (!user) {
      setPending({ kind: "await_extend_user" });
      return [{ text: "Who should I extend? Send a username." }];
    }
    const days = Math.max(1, Math.min(365, parseInt(daysRaw ?? "7", 10) || 7));
    return [{ text: useApp.getState().extend(user, days) }];
  }
  if (c === "/fail" && arg) return failCard(arg);
  if (c === "/newplan") {
    setPending({ kind: "await_plan_name" });
    return [{ text: "Name the plan (for example Premium)." }];
  }

  const hit = useApp.getState().communityBySlug(text.replace(/^\//, ""));
  if (hit) return showCommunity(hit.code);

  return [
    {
      text: "Send a creator ID or group name to join (try LA-ADA or Lagos Alpha), or tap I run a group to buy an ID.",
      buttons: menu(),
    },
  ];
}

function handlePending(text: string, pending: NonNullable<ReturnType<typeof useApp.getState>["pending"]>): Reply[] {
  const { setPending, connectBank, createCommunity, addPlan, addFilter, kick, extend } = useApp.getState();
  if (text.toLowerCase() === "/cancel" || text.toLowerCase() === "cancel") {
    setPending(null);
    return [{ text: "Cancelled.", buttons: menu() }];
  }

  if (pending.kind === "await_nuban") {
    if (!isNuban(text)) return [{ text: "Enter a 10-digit NUBAN account number." }];
    setPending(null);
    return [
      {
        text: connectBank(pending.bankCode, text),
        buttons: [[{ label: "Studio", payload: "studio", tone: "primary" }]],
      },
    ];
  }
  if (pending.kind === "await_checkout_currency") {
    const ccy = parseCurrency(text);
    const plan = useApp.getState().plans.find((p) => p.id === pending.planId);
    if (!ccy || !plan) {
      return [
        {
          text: "I don’t quote that currency yet. Try USD, EUR, GBP, NGN, GHS, KES — or tap More currencies.",
          buttons: plan
            ? featuredCheckoutButtons(plan.id, plan.priceUsd)
            : [[{ label: "Join a group", payload: "discover" }]],
        },
      ];
    }
    setPending(null);
    return chooseMethod(pending.planId, ccy);
  }
  if (pending.kind === "await_pro_currency") {
    const ccy = parseCurrency(text);
    if (!ccy) {
      return [
        {
          text: "I don’t quote that currency yet. Try USD, EUR, naira, yen — or tap More currencies.",
          buttons: featuredProButtons(),
        },
      ];
    }
    setPending(null);
    return chooseProMethod(ccy);
  }
  if (pending.kind === "await_community_name") {
    setPending({ kind: "await_community_price", name: text.slice(0, 48), platformPlan: pending.platformPlan });
    return [
      {
        text: `Got “${text.slice(0, 48)}”. Send the monthly price members will pay, in US dollars, digits only (e.g. 15).`,
      },
    ];
  }
  if (pending.kind === "await_community_price") {
    const dollars = parseInt(text.replace(/[^\d]/g, ""), 10);
    if (!dollars || dollars < 1) return [{ text: "Send a monthly price of at least 1 US dollar." }];
    setPending({
      kind: "await_community_bank",
      name: pending.name,
      priceUsd: dollars * 100,
      platformPlan: pending.platformPlan,
    });
    return [
      {
        text: `Got it. Members pay ${formatMoney(dollars * 100)} / month for “${pending.name}”.\n\nNow attach a bank account to this ID. Your share settles there. The platform percentage credits the operator Telegram wallet. Customers never see that split.\n\nPick the bank.`,
        buttons: bankButtons(),
      },
    ];
  }
  if (pending.kind === "await_community_bank") {
    return attachAccountPrompt();
  }
  if (pending.kind === "await_community_nuban") {
    if (!isNuban(text)) return [{ text: "Enter a 10-digit NUBAN account number." }];
    setPending(null);
    const community = createCommunity(pending.name, pending.priceUsd, pending.platformPlan, {
      bankCode: pending.bankCode,
      accountNumber: text,
    });
    const dest = destinationFor(community);
    return [
      {
        text: `You're live.\n\nCreator ID  ${community.code}\nGroup  ${community.name}\nMembers pay ${formatMoney(pending.priceUsd)} / month\nAccount on this ID  ${dest ?? "not attached"}\n\nYour share hits that account. The platform percentage credits the operator Telegram wallet. Customers never see the split.\n\nTell customers:\nsend ${community.code} to @TeleMonetizeBot\nor send ${community.name} to @TeleMonetizeBot\n\nAdd this bot as admin with Invite users and Ban users.`,
        buttons: [
          [
            { label: "Studio", payload: "studio", tone: "primary" },
            { label: "Copy ID", payload: "link" },
          ],
        ],
      },
    ];
  }
  if (pending.kind === "await_plan_name") {
    setPending({ kind: "await_plan_price", name: text.slice(0, 32) });
    return [{ text: `Price for ${text.slice(0, 32)} in US dollars, digits only (e.g. 15).` }];
  }
  if (pending.kind === "await_plan_price") {
    const dollars = parseInt(text.replace(/[^\d]/g, ""), 10);
    if (!dollars || dollars < 1) return [{ text: "Send at least 1 US dollar." }];
    setPending(null);
    const plan = addPlan(pending.name, dollars * 100);
    return [
      {
        text: `${plan.name} · ${formatMoney(plan.priceUsd)} / ${intervalLabel(plan.interval)} is live.`,
        buttons: [[{ label: "Plans", payload: "plans_owner" }]],
      },
    ];
  }
  if (pending.kind === "await_kick") {
    setPending(null);
    return [{ text: kick(text) }];
  }
  if (pending.kind === "await_extend_user") {
    setPending({ kind: "await_extend_days", username: text.replace(/^@/, "") });
    return [{ text: "How many days? (1–365)" }];
  }
  if (pending.kind === "await_extend_days") {
    setPending(null);
    const days = Math.max(1, Math.min(365, parseInt(text, 10) || 7));
    return [{ text: extend(pending.username, days) }];
  }
  if (pending.kind === "await_filter") {
    setPending(null);
    const keyword = text.trim().toLowerCase();
    addFilter(keyword, "remove");
    return [{ text: `Filter added: “${keyword}” → remove.`, buttons: [[{ label: "Moderation", payload: "moderation" }]] }];
  }
  if (pending.kind === "await_scan") {
    setPending(null);
    const community = useApp.getState().ownedCommunity();
    if (!community) return notCreator();
    const event = useApp.getState().moderateText(community.id, { id: "scan", username: "scan", name: "Scan" }, text);
    return [
      {
        text: `${event.classification} · ${event.action} (${Math.round(event.confidence * 100)}%)\n${event.reason}`,
        buttons: [[{ label: "Moderation", payload: "moderation" }]],
      },
    ];
  }
  setPending(null);
  return [{ text: "Cancelled.", buttons: MAIN }];
}

export function handleCallback(payload: string): Reply[] {
  const { setRole, setActingAs, setPending, selectChat } = useApp.getState();

  if (payload === "discover") return discover();
  if (payload === "my") return mySeats();
  if (payload === "help") return handleHelp();
  if (payload === "studio") return studio();
  if (payload === "become_creator") return becomeCreator();
  if (payload === "creator_plan:trial") return startCreatorPlan("trial");
  if (payload === "creator_plan:pro" || payload === "pro_pay") return payPro();
  if (payload === "propay:card") return startCreatorPlan("pro");
  if (payload === "propay:transfer") return payProTransfer();
  if (payload === "promore") {
    return [
      {
        text: "More currencies for Pro. Dollar is still the list price.",
        buttons: [
          ...pairCurrencyButtons(PRO_USD_CENTS, MORE_CURRENCIES, (code) => `proccy:${code}`),
          [{ label: "Back", payload: "pro_pay" }],
        ],
      },
    ];
  }
  if (payload === "prototype") {
    setPending({ kind: "await_pro_currency" });
    return [{ text: "Send a currency code or name — USD, EUR, naira, yen, rand…" }];
  }
  if (payload === "status") return status();
  if (payload === "members") return membersList();
  if (payload === "plans_owner") return ownerPlans();
  if (payload === "link") return checkoutLink();
  if (payload === "payout") return payout();
  if (payload === "payout_change") return attachAccountPrompt(useApp.getState().ownedCommunity()?.code);
  if (payload === "earnings") return earnings();
  if (payload === "take") return yourTake();
  if (payload === "moderation") return moderation();
  if (payload === "loop") return loop();
  if (payload === "cancel") {
    setPending(null);
    return [{ text: "Cancelled.", buttons: menu() }];
  }
  if (payload === "as_adaeze") {
    setRole("creator");
    setActingAs("adaeze");
    return studio();
  }
  if (payload === "as_creator") return becomeCreator();
  if (payload === "as_member") {
    setRole("member");
    setActingAs("self");
    return startWelcome();
  }
  if (payload === "why_cards") {
    return [
      {
        text: "Checkout opens after the creator attaches a bank account to their ID. Customers then pay by card or bank transfer in USD or another listed currency.",
        buttons: [[{ label: "Join a group", payload: "discover" }]],
      },
    ];
  }
  if (payload === "newplan") {
    setPending({ kind: "await_plan_name" });
    return [{ text: "Name the plan (for example Premium)." }];
  }
  if (payload === "filter_add") {
    setPending({ kind: "await_filter" });
    return [{ text: "Send the keyword to remove on sight." }];
  }
  if (payload === "scan") {
    setPending({ kind: "await_scan" });
    return [{ text: "Paste a group message. I’ll classify it (keyword first, then heuristics)." }];
  }
  if (payload.startsWith("community:")) return showCommunity(payload.slice("community:".length));
  if (payload.startsWith("plan:")) return showPlan(payload.slice("plan:".length));
  if (payload.startsWith("moreccy:")) {
    const planId = payload.slice("moreccy:".length);
    const plan = useApp.getState().plans.find((p) => p.id === planId);
    if (!plan) return [{ text: "Plan not found." }];
    return [
      {
        text: `${plan.name} · more currencies. Dollar is still the list price.`,
        buttons: moreCheckoutButtons(plan.id, plan.priceUsd),
        kind: "invoice",
      },
    ];
  }
  if (payload.startsWith("typeccy:")) {
    const planId = payload.slice("typeccy:".length);
    const plan = useApp.getState().plans.find((p) => p.id === planId);
    if (!plan) return [{ text: "Plan not found." }];
    setPending({ kind: "await_checkout_currency", planId });
    return [{ text: "Send a currency code or name — USD, EUR, naira, yen, rand, cedi…" }];
  }
  if (payload.startsWith("ccy:")) {
    const [, planId, ccy] = payload.split(":");
    if (!planId || !ccy || !isCurrency(ccy)) return [{ text: "Pick a currency." }];
    return chooseMethod(planId, ccy);
  }
  if (payload.startsWith("paid:")) {
    const [, planId, ccy] = payload.split(":");
    if (!planId || !ccy || !isCurrency(ccy)) return [{ text: "Bad payment payload." }];
    return pay(planId, "transfer", ccy);
  }
  if (payload.startsWith("pay:")) {
    const [, planId, ccy, method] = payload.split(":");
    if (!planId || !ccy || !isCurrency(ccy)) return [{ text: "Bad payment payload." }];
    if (method === "transfer") return showTransfer(planId, ccy);
    return pay(planId, "card", ccy);
  }
  if (payload.startsWith("proccy:")) {
    const ccy = payload.slice("proccy:".length);
    if (!isCurrency(ccy)) return [{ text: "Pick a currency." }];
    return chooseProMethod(ccy);
  }
  if (payload.startsWith("propay:")) {
    const parts = payload.split(":");
    if (parts.length === 2) {
      if (parts[1] === "transfer") return payProTransfer("USD");
      return startCreatorPlan("pro");
    }
    const ccy = parts[1];
    const method = parts[2];
    if (!ccy || !isCurrency(ccy)) return [{ text: "Pick a currency." }];
    if (method === "transfer") return payProTransfer(ccy);
    return startCreatorPlan("pro");
  }
  if (payload.startsWith("openchat:")) {
    const id = payload.slice("openchat:".length);
    selectChat(id);
    return [];
  }
  if (payload.startsWith("kick:")) {
    return [{ text: useApp.getState().kick(payload.slice("kick:".length)) }];
  }
  if (payload.startsWith("extend:")) {
    const [, user, days] = payload.split(":");
    if (!user) return [{ text: "Tag a member." }];
    return [{ text: useApp.getState().extend(user, parseInt(days ?? "7", 10) || 7) }];
  }
  if (payload.startsWith("bank:")) {
    const code = payload.slice("bank:".length);
    const current = useApp.getState().pending;
    const bank = NG_BANKS.find((b) => b.code === code);
    if (current?.kind === "await_community_bank") {
      setPending({
        kind: "await_community_nuban",
        name: current.name,
        priceUsd: current.priceUsd,
        platformPlan: current.platformPlan,
        bankCode: code,
      });
      return [
        {
          text: `${bank?.name ?? "Bank"} will be attached to this ID. Member money for this ID will settle there. Send the 10-digit NUBAN.`,
        },
      ];
    }
    setPending({ kind: "await_nuban", bankCode: code });
    return [
      {
        text: `${bank?.name ?? "Bank"} selected for this ID. Send the 10-digit NUBAN. Member money for this ID will go there.`,
      },
    ];
  }
  if (payload.startsWith("fail:")) return failCard(payload.slice("fail:".length));
  return handleInput(payload);
}

export function bootFromIntent(as: "adaeze" | "creator" | "join") {
  const { selectChat, setRole, setActingAs } = useApp.getState();
  selectChat(BOT_CHAT_ID);
  useApp.setState((s) => ({
    messages: { ...s.messages, [BOT_CHAT_ID]: [] },
    pending: null,
  }));
  if (as === "adaeze") {
    setRole("creator");
    setActingAs("adaeze");
    send(studio());
    return;
  }
  if (as === "creator") {
    send(becomeCreator());
    return;
  }
  setRole("member");
  setActingAs("self");
  send([
    {
      text: "Send a creator ID or the group name. Dollar is the list price — pay in USD or another currency, by card or bank transfer. I send the join link.",
      buttons: CUSTOMER_MAIN,
    },
  ]);
  send(showCommunity("LA-ADA"));
}

export async function submitUserText(text: string) {
  const { selectedChatId, pushMe, isMemberOf, communities, me, moderateText, pushSystem, setTyping } =
    useApp.getState();
  const trimmed = text.trim();
  if (!trimmed) return;

  if (selectedChatId !== BOT_CHAT_ID) {
    const community = communities.find((c) => c.chatId === selectedChatId);
    if (!community) return;
    const person = me();
    const member = isMemberOf(community.id) || community.ownerId === person.id;
    if (!member) {
      pushMe(trimmed);
      useApp.getState().pushBot(
        `${community.name} is private. Pay on checkout and I send the invite here.`,
        [[{ label: `Join ${community.name}`, payload: `community:${community.code}`, tone: "primary" }]],
      );
      useApp.getState().selectChat(BOT_CHAT_ID);
      return;
    }
    useApp.getState().pushMember(selectedChatId, person, trimmed);
    const event = moderateText(community.id, person, trimmed);
    if (event.action === "removed") {
      pushSystem(selectedChatId, `Removed @${person.username} — ${event.reason}`);
    } else if (event.action === "flagged") {
      pushSystem(selectedChatId, `Flagged @${person.username} — ${event.reason}`);
    }
    return;
  }

  pushMe(trimmed);
  setTyping(true);
  await wait(420);
  const replies = handleInput(trimmed);
  setTyping(false);
  send(replies);
}

export async function submitCallback(payload: string) {
  if (payload.startsWith("openchat:")) {
    useApp.getState().selectChat(payload.slice("openchat:".length));
    return;
  }
  const { setTyping } = useApp.getState();
  setTyping(true);
  await wait(280);
  const replies = handleCallback(payload);
  setTyping(false);
  send(replies);
}

export function ensureWelcome() {
  const msgs = useApp.getState().messages[BOT_CHAT_ID] ?? [];
  if (msgs.length > 0) return;
  send(startWelcome());
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
