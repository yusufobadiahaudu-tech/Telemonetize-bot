import { formatCharge } from "@/lib/currency";
import { destinationFor, formatMoney, intervalLabel, providerLabel } from "@/lib/format";
import { botMention } from "@/lib/product";
import { useApp } from "@/lib/store";
import type { BotReply, Effect, ReduceResult } from "./effects";

function checkoutReply(opts: {
  title: string;
  amountLabel: string;
  authorizationUrl: string;
  reference: string;
  demo: boolean;
}): BotReply {
  const buttons: import("@/lib/types").InlineBtn[][] = [
    [{ label: `Pay ${opts.amountLabel}`, payload: `openpay:${opts.reference}`, url: opts.authorizationUrl, tone: "primary" }],
  ];
  if (opts.demo) {
    buttons.push([{ label: "Simulate charge.success", payload: `simcharge:${opts.reference}`, tone: "primary" }]);
  }
  return {
    text: `${opts.title}\n\nCheckout is open.\n${opts.authorizationUrl}\n\nThe join link is minted only after charge.success.`,
    buttons,
    kind: "invoice",
  };
}

export function applyClientResult(result: ReduceResult): BotReply[] {
  const store = useApp.getState();
  store.setRole(result.role);
  if (result.actingAs) store.setActingAs(result.actingAs);
  store.setPending(result.pending);

  const extra: BotReply[] = [];
  for (const effect of result.effects) {
    extra.push(...applyClientEffect(effect));
  }
  return [...result.replies, ...extra];
}

function applyClientEffect(effect: Effect): BotReply[] {
  const store = useApp.getState();
  switch (effect.type) {
    case "checkout": {
      const started = store.initializeCheckout(effect.planId, effect.provider, effect.currency);
      if (!started.ok) return [{ text: started.error }];
      return [
        checkoutReply({
          title: `${started.community.name} · ${started.plan.name}`,
          amountLabel: formatCharge(started.plan.priceUsd, effect.currency),
          authorizationUrl: started.authorizationUrl,
          reference: started.reference,
          demo: started.demo,
        }),
      ];
    }
    case "checkout_pro": {
      const started = store.initializeProCheckout(effect.provider, effect.currency);
      if (!started.ok) return [{ text: started.error }];
      return [
        checkoutReply({
          title: "TeleMonetize Pro · $15 / month",
          amountLabel: formatCharge(1500, effect.currency),
          authorizationUrl: started.authorizationUrl,
          reference: started.reference,
          demo: started.demo,
        }),
      ];
    }
    case "fulfill": {
      const done = store.fulfillCharge(effect.reference);
      if (!done.ok) return [{ text: done.error }];
      if (done.kind === "pro") {
        return [
          {
            text: "Pro is live. $15 received. 5% of each member payment will credit the operator Telegram wallet.\n\nSend the Telegram group name you want bound to your ID (for example “Lagos Desk”).",
            buttons: [[{ label: "Cancel", payload: "cancel" }]],
          },
        ];
      }
      return [
        {
          text: `Payment received.\n\n${done.community.name} · ${done.plan.name}\n${formatCharge(done.plan.priceUsd, done.currency)} via ${providerLabel(done.provider)}\n\nYou're in. Tap to join the ${done.community.chatType}:\n${done.inviteUrl}`,
          buttons: [
            [{ label: `Open ${done.community.name}`, payload: `openchat:${done.community.chatId}`, tone: "primary" }],
            [{ label: "My seats", payload: "my" }],
          ],
          kind: "receipt",
        },
      ];
    }
    case "kick":
      return [{ text: store.kick(effect.username, effect.reason) }];
    case "extend":
      return [{ text: store.extend(effect.username, effect.days) }];
    case "fail_card":
      store.markCardFailing(effect.username);
      return [];
    case "create_community": {
      const community = store.createCommunity(effect.name, effect.priceUsd, effect.platformPlan, {
        bankCode: effect.bankCode,
        accountNumber: effect.accountNumber,
      });
      const dest = destinationFor(community);
      return [
        {
          text: `You're live.\n\nCreator ID  ${community.code}\nGroup  ${community.name}\nMembers pay ${formatMoney(effect.priceUsd)} / month\nAccount on this ID  ${dest ?? "not attached"}\n\nYour share hits that account. The platform percentage credits the operator Telegram wallet. Customers never see the split.\n\nTell customers:\nsend ${community.code} to ${botMention()}\nor send ${community.name} to ${botMention()}\n\nAdd ${botMention()} as admin with Invite users and Ban users.`,
          buttons: [
            [
              { label: "Studio", payload: "studio", tone: "primary" },
              { label: "Copy ID", payload: "link" },
            ],
          ],
        },
      ];
    }
    case "connect_bank":
      return [
        {
          text: store.connectBank(effect.bankCode, effect.accountNumber),
          buttons: [[{ label: "Studio", payload: "studio", tone: "primary" }]],
        },
      ];
    case "connect_payout":
      return [
        {
          text: "Live payouts are Nigerian bank accounts via Paystack. Other rails are paused until each one has a settlement API.",
          buttons: [[{ label: "Studio", payload: "studio", tone: "primary" }]],
        },
      ];
    case "add_plan": {
      const plan = store.addPlan(effect.name, effect.priceUsd);
      return [
        {
          text: `${plan.name} · ${formatMoney(plan.priceUsd)} / ${intervalLabel(plan.interval)} is live.`,
          buttons: [[{ label: "Plans", payload: "plans_owner" }]],
        },
      ];
    }
    case "add_filter":
      store.addFilter(effect.keyword, effect.action);
      return [];
    case "scan": {
      const community = store.ownedCommunity();
      if (!community) return [{ text: "Create a community first." }];
      const event = store.moderateText(community.id, { id: "scan", username: "scan", name: "Scan" }, effect.text);
      return [
        {
          text: `${event.classification} · ${event.action} (${Math.round(event.confidence * 100)}%)\n${event.reason}`,
          buttons: [[{ label: "Moderation", payload: "moderation" }]],
        },
      ];
    }
    case "run_loop": {
      const community = store.ownedCommunity();
      const r = store.runLoop();
      const name = community?.name ?? "your group";
      return [
        {
          text: `Money loop on ${name}\n${r.renewed} renewed\n${r.retried} retried\n${r.warned} warned in Telegram\n${r.expired} expired\n${r.kicked} kicked\n${r.reminded} reminded (3-day)\n\nRetry. Warn. Then kick and revoke invite links. Cron runs this; this was a manual override.`,
          buttons: [
            [
              { label: "Members", payload: "members" },
              { label: "Status", payload: "status" },
            ],
          ],
        },
      ];
    }
    case "open_chat":
      store.selectChat(effect.chatId);
      return [];
    case "log":
      store.log(effect.communityId, effect.event, effect.message);
      return [];
    default:
      return [];
  }
}
