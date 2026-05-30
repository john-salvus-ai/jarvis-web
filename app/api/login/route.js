import { COOKIE_NAME, authToken, getPassword } from "../../../lib/auth";

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  const pw = getPassword();

  if (!pw) {
    return Response.json(
      { ok: false, error: "Server password not configured." },
      { status: 503 }
    );
  }
  if (!password || password !== pw) {
    return Response.json({ ok: false, error: "Incorrect password." }, { status: 401 });
  }

  const token = await authToken(pw);

  // Only mark the cookie Secure over HTTPS (home server runs plain HTTP).
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (() => { try { return new URL(req.url).protocol.replace(":", ""); } catch { return "http"; } })();
  const secure = proto === "https" ? "; Secure" : "";

  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${60 * 60 * 24 * 30}`
  );
  return res;
}
