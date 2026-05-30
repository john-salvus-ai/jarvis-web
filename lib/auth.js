// Shared auth helpers — safe in both the Edge (middleware) and Node runtimes.
const enc = new TextEncoder();

async function sha256b64url(str) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const COOKIE_NAME = "jarvis_auth";

// The single source of truth. Set JARVIS_PASSWORD in the environment.
export function getPassword() {
  return process.env.JARVIS_PASSWORD || "";
}

// Token stored in the browser cookie after a successful login.
export async function authToken(pw) {
  return sha256b64url((pw || "") + ":auth");
}

// Secret the Vercel server uses to call the home server's API server-to-server.
// Derived from the same password, so you only ever set ONE variable.
export async function proxyToken(pw) {
  return sha256b64url((pw || "") + ":proxy");
}
