"use client";
import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const params = new URLSearchParams(window.location.search);
        window.location.href = params.get("next") || "/";
        return;
      }
      setErr(data.error || "Access denied.");
    } catch (_) {
      setErr("Connection error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(circle at 50% 40%, #02101f 0%, #000308 70%)",
      fontFamily: "'Share Tech Mono', monospace", color: "#00d4ff",
    }}>
      <form onSubmit={submit} style={{
        width: "min(360px, 90vw)", padding: "32px 28px", textAlign: "center",
        border: "1px solid rgba(0,212,255,0.35)", borderRadius: 12,
        background: "rgba(0,20,40,0.45)", boxShadow: "0 0 40px rgba(0,212,255,0.12)",
      }}>
        <img src="/salvus-logo.png" alt="" style={{ height: 40, opacity: 0.9, marginBottom: 14 }} />
        <div style={{ fontSize: "1.4rem", letterSpacing: "0.35em", fontWeight: 700, marginBottom: 4 }}>
          J.A.R.V.I.S.
        </div>
        <div style={{ fontSize: "0.62rem", letterSpacing: "0.25em", opacity: 0.55, marginBottom: 24 }}>
          AUTHORIZATION REQUIRED
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          placeholder="ENTER PASSCODE"
          style={{
            width: "100%", padding: "12px 14px", marginBottom: 14, textAlign: "center",
            background: "rgba(0,0,0,0.5)", border: "1px solid rgba(0,212,255,0.4)",
            borderRadius: 8, color: "#00d4ff", fontFamily: "inherit", fontSize: "0.95rem",
            letterSpacing: "0.15em", outline: "none",
          }}
        />
        <button type="submit" disabled={busy} style={{
          width: "100%", padding: "12px", cursor: busy ? "default" : "pointer",
          background: busy ? "rgba(0,120,170,0.3)" : "rgba(0,150,210,0.25)",
          border: "1px solid rgba(0,212,255,0.6)", borderRadius: 8, color: "#00d4ff",
          fontFamily: "inherit", fontSize: "0.85rem", letterSpacing: "0.2em",
        }}>
          {busy ? "VERIFYING..." : "AUTHENTICATE"}
        </button>
        {err && (
          <div style={{ marginTop: 14, fontSize: "0.7rem", color: "#ff5a6e", letterSpacing: "0.1em" }}>
            {err}
          </div>
        )}
      </form>
    </div>
  );
}
