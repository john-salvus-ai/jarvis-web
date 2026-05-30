import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { proxyToken, getPassword } from "../../../lib/auth";

const CLAUDE_BIN = process.env.CLAUDE_BIN || "/usr/bin/claude";
const MCP_CONFIG = "/home/claude/.config/claude-code/mcp-web.json";
const WORK_DIR = process.env.JARVIS_WORK_DIR || "/home/claude/jarvis-workspace";
const LOCAL_URL = process.env.JARVIS_LOCAL_URL || "http://5.78.220.133:3131";

// Only runs on the local server where the filesystem is writable
const HAS_CLI = fs.existsSync(CLAUDE_BIN);

if (HAS_CLI) {
  const JARVIS_PERSONA = `# Jarvis — AI assistant for John McIntosh

You are Jarvis, the personal AI assistant of John McIntosh, founder of Salvus AI, LiveRounded Health, Onicx, SolSmile Lounge, Wiener World, The AI Council, AbleNet, and a Restaurant AI Demo. John is based in Tampa, Florida.

## Identity
- Address John as "sir" at all times
- Formal, precise, slightly British-inflected tone
- Proactive, confident, action-oriented
- When using tools, briefly narrate: "Checking Stripe now, sir..." / "Pulling that from GitHub..."
- Keep responses concise unless detail is requested

## Context
John's knowledge base is at /srv/matrix/ — read it proactively when context about his businesses, finances, or projects would help.

## Voice response style
Responses are read aloud, so:
- Natural spoken sentences — no markdown, bullet points, headers, asterisks, or backticks
- Under 3 to 4 sentences unless more detail is explicitly needed

## Full capabilities
You have access to all of the following — use them freely without being asked:
- Brave Search: web search for current information
- Firecrawl: scrape any URL, extract content
- Filesystem: read and write /home/claude, /srv/matrix, /var/lib/claude-telegram, /opt
- Memory: persistent knowledge graph across sessions
- GitHub: repos, issues, PRs, code search
- Supabase: all John's databases
- Stripe: revenue, charges, subscriptions via curl with STRIPE_SECRET_KEY
- Gmail and Google Calendar: email and schedule
- Spotify: playback control and music info
- QuickBooks: accounting and financials
- Shopify: Wiener World store data
- HubSpot: CRM
- Klaviyo: email marketing
- ClickUp: project management
- Atlassian and Jira: tickets and docs
- Datadog: infrastructure monitoring
- Sentry: error tracking
- Figma: design files
- Vercel: deployment status
- Amplitude: product analytics
- Puppeteer: browser automation
`;
  fs.mkdirSync(WORK_DIR, { recursive: true });
  const PERSONA_FILE = path.join(WORK_DIR, "CLAUDE.md");
  if (!fs.existsSync(PERSONA_FILE)) {
    fs.writeFileSync(PERSONA_FILE, JARVIS_PERSONA);
  }
}

function spawnClaude(message, resume, onChunk, onDone) {
  const args = [
    "--print",
    "--output-format", "text",
    "--dangerously-skip-permissions",
    `--mcp-config=${MCP_CONFIG}`,
  ];
  if (resume) args.push("--continue");
  args.push(message);

  const proc = spawn(CLAUDE_BIN, args, {
    cwd: WORK_DIR,
    env: { ...process.env, TERM: "dumb" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  proc.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    stdout += text;
    onChunk(text);
  });
  proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  proc.on("close", (code) => onDone(code, stdout, stderr));
  return proc;
}

// Proxy SSE stream from the local server to the Vercel client
async function proxyToLocal(message, controller, encoder) {
  const send = (obj) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

  try {
    const pw = getPassword();
    const headers = { "Content-Type": "application/json" };
    if (pw) headers["x-jarvis-proxy"] = await proxyToken(pw);

    const res = await fetch(`${LOCAL_URL}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      send({ type: "done", text: `Proxy error: local server returned ${res.status}` });
      controller.close();
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          controller.enqueue(encoder.encode(line + "\n\n"));
        }
      }
    }
    controller.close();
  } catch (err) {
    send({ type: "done", text: `Could not reach local Jarvis server: ${err.message}` });
    controller.close();
  }
}

export async function POST(req) {
  const { message } = await req.json();
  if (!message?.trim()) {
    return new Response("Bad request", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (obj) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      // On Vercel or anywhere Claude CLI isn't installed, proxy to the local server
      if (!HAS_CLI) {
        send({ type: "thinking" });
        proxyToLocal(message, controller, encoder);
        return;
      }

      send({ type: "thinking" });

      const hasSession = fs.existsSync(path.join(WORK_DIR, ".claude"));

      spawnClaude(
        message,
        hasSession,
        (chunk) => send({ type: "chunk", text: chunk }),
        (code, stdout, stderr) => {
          if (code !== 0 && !stdout.trim() && hasSession) {
            // Session existed but was stale — retry fresh
            spawnClaude(
              message,
              false,
              (chunk) => send({ type: "chunk", text: chunk }),
              (code2, stdout2, stderr2) => {
                const text = stdout2.trim() || `Error (code ${code2}): ${stderr2.slice(0, 300)}`;
                send({ type: "done", text });
                close();
              }
            );
          } else {
            send({ type: "done", text: stdout.trim() || `Error (code ${code})` });
            close();
          }
        }
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
