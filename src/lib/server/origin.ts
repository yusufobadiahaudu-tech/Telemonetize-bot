export function publicOrigin() {
  const env =
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;
  if (env) {
    return env.startsWith("http") ? env.replace(/\/$/, "") : `https://${env.replace(/\/$/, "")}`;
  }
  return "http://127.0.0.1:8080";
}
