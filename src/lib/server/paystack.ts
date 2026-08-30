import { createHmac, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";

export type PaystackMode = "test" | "live";

export type PaystackKeys = {
  secret: string;
  publicKey: string;
  mode: PaystackMode;
};

function modeFromSecret(secret: string): PaystackMode {
  return secret.startsWith("sk_live_") ? "live" : "test";
}

export function looksLikePaystackSecret(value: string) {
  return /^sk_(test|live)_[A-Za-z0-9]+$/.test(value.trim());
}

export async function getPaystackKeys(): Promise<PaystackKeys | null> {
  const envSecret = process.env.PAYSTACK_SECRET_KEY?.trim();
  const envPublic = process.env.PAYSTACK_PUBLIC_KEY?.trim() ?? "";
  if (envSecret && looksLikePaystackSecret(envSecret)) {
    return { secret: envSecret, publicKey: envPublic, mode: modeFromSecret(envSecret) };
  }
  const sql = await getSql();
  const rows = await sql<{ paystack_secret_key: string | null; paystack_public_key: string | null }>`
    select paystack_secret_key, paystack_public_key from platform_bot where id = 'singleton' limit 1
  `;
  const secret = rows[0]?.paystack_secret_key?.trim() ?? "";
  if (!secret || !looksLikePaystackSecret(secret)) return null;
  return {
    secret,
    publicKey: rows[0]?.paystack_public_key?.trim() ?? "",
    mode: modeFromSecret(secret),
  };
}

type PaystackJson = {
  status: boolean;
  message?: string;
  data?: Record<string, unknown>;
};

async function paystackFetch(path: string, init?: RequestInit): Promise<PaystackJson> {
  const keys = await getPaystackKeys();
  if (!keys) throw new Error("Paystack is not connected");
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${keys.secret}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json()) as PaystackJson;
  if (!res.ok || !body.status) {
    throw new Error(body.message || `Paystack error ${res.status}`);
  }
  return body;
}

export async function initializeTransaction(opts: {
  email: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  currency: string;
  channels: Array<"card" | "bank" | "bank_transfer">;
  subaccount?: string | null;
  metadata: Record<string, unknown>;
}) {
  const payload: Record<string, unknown> = {
    email: opts.email,
    amount: opts.amount,
    reference: opts.reference,
    callback_url: opts.callbackUrl,
    currency: opts.currency === "NGN" ? "NGN" : "USD",
    channels: opts.channels,
    metadata: opts.metadata,
  };
  if (opts.subaccount) {
    payload.subaccount = opts.subaccount;
    payload.bearer = "account";
  }
  const body = await paystackFetch("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = body.data as { authorization_url?: string; access_code?: string; reference?: string };
  if (!data?.authorization_url) throw new Error("Paystack did not return a checkout URL");
  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code ?? null,
    reference: data.reference ?? opts.reference,
  };
}

export async function verifyTransaction(reference: string) {
  const body = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
  const data = body.data as {
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    paid_at?: string;
    metadata?: Record<string, unknown>;
  };
  const status =
    data.status === "success" ? "success" : data.status === "abandoned" ? "abandoned" : "failed";
  return {
    status: status as "success" | "failed" | "abandoned",
    reference: data.reference ?? reference,
    amount: Number(data.amount) || 0,
    currency: data.currency ?? "NGN",
    paidAt: data.paid_at ?? null,
    metadata: data.metadata ?? {},
  };
}

export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
