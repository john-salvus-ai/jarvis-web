import fs from "fs";
import path from "path";

const WORK_DIR = process.env.JARVIS_WORK_DIR || "/home/claude/jarvis-workspace";

export async function POST() {
  try {
    // Claude stores conversation state in .claude/ subdir of cwd
    const claudeDir = path.join(WORK_DIR, ".claude");
    if (fs.existsSync(claudeDir)) {
      fs.rmSync(claudeDir, { recursive: true, force: true });
    }
    // Also remove any legacy conversation files
    for (const f of [".claude_conversation", "CLAUDE.jsonl"]) {
      const fp = path.join(WORK_DIR, f);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
