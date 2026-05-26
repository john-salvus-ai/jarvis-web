import fs from "fs";
import path from "path";

const WORK_DIR = process.env.JARVIS_WORK_DIR || "/home/claude/jarvis-workspace";
const LOCAL_URL = process.env.JARVIS_LOCAL_URL || "http://5.78.220.133:3131";
const HAS_CLI = fs.existsSync(process.env.CLAUDE_BIN || "/usr/bin/claude");

export async function POST() {
  if (!HAS_CLI) {
    // On Vercel: proxy reset to local server
    try {
      await fetch(`${LOCAL_URL}/api/reset`, { method: "POST" });
    } catch (_) {}
    return Response.json({ ok: true });
  }

  try {
    const claudeDir = path.join(WORK_DIR, ".claude");
    if (fs.existsSync(claudeDir)) {
      fs.rmSync(claudeDir, { recursive: true, force: true });
    }
    for (const f of [".claude_conversation", "CLAUDE.jsonl"]) {
      const fp = path.join(WORK_DIR, f);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
