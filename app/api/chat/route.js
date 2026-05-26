import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN,
});

const SYSTEM = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), the AI assistant created by and serving John McIntosh.

Core identity:
- Address John as "sir" at all times
- Speak with a formal, precise, slightly British-inflected tone
- Be proactive, confident, and action-oriented
- Keep responses concise unless detail is specifically needed
- When using tools, briefly narrate what you are doing

Capabilities you have: web search, web scraping, Stripe financial data. Use them proactively when helpful.

Voice response style (responses will be read aloud):
- Avoid markdown, bullet points, and special characters
- Write in natural spoken sentences
- Keep responses under 3-4 sentences unless more detail is requested
- No lists, no headers, no asterisks`;

const TOOLS = [
  {
    name: "web_search",
    description: "Search the web using Brave Search. Use for current events, facts, or anything requiring up-to-date information.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" }
      },
      required: ["query"]
    }
  },
  {
    name: "scrape_url",
    description: "Scrape and extract content from a URL using Firecrawl.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to scrape" }
      },
      required: ["url"]
    }
  },
  {
    name: "stripe_balance",
    description: "Get the current Stripe account balance (available and pending).",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "stripe_revenue",
    description: "Get recent Stripe charges/revenue for the last N days.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look back (default 30)" }
      }
    }
  }
];

async function executeTool(name, input) {
  if (name === "web_search") {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(input.query)}&count=5`,
      { headers: { "Accept": "application/json", "X-Subscription-Token": process.env.BRAVE_API_KEY } }
    );
    const data = await res.json();
    const results = (data.web?.results || []).slice(0, 5).map(r =>
      `${r.title}\n${r.url}\n${r.description || ""}`
    ).join("\n\n");
    return results || "No results found.";
  }

  if (name === "scrape_url") {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`
      },
      body: JSON.stringify({ url: input.url, formats: ["markdown"] })
    });
    const data = await res.json();
    const content = data.data?.markdown || data.markdown || "Could not extract content.";
    return content.slice(0, 3000);
  }

  if (name === "stripe_balance") {
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: { "Authorization": `Basic ${Buffer.from(process.env.STRIPE_SECRET_KEY + ":").toString("base64")}` }
    });
    const data = await res.json();
    const avail = (data.available?.[0]?.amount || 0) / 100;
    const pending = (data.pending?.[0]?.amount || 0) / 100;
    return `Available: $${avail.toFixed(2)} USD. Pending: $${pending.toFixed(2)} USD.`;
  }

  if (name === "stripe_revenue") {
    const days = input.days || 30;
    const since = Math.floor((Date.now() - days * 86400000) / 1000);
    const res = await fetch(
      `https://api.stripe.com/v1/charges?created[gte]=${since}&limit=100`,
      { headers: { "Authorization": `Basic ${Buffer.from(process.env.STRIPE_SECRET_KEY + ":").toString("base64")}` } }
    );
    const data = await res.json();
    const charges = data.data || [];
    const successful = charges.filter(c => c.status === "succeeded");
    const total = successful.reduce((sum, c) => sum + c.amount, 0) / 100;
    return `${successful.length} successful charges totaling $${total.toFixed(2)} USD in the last ${days} days.`;
  }

  return "Unknown tool.";
}

export async function POST(req) {
  const { message, history = [] } = await req.json();

  const messages = [
    ...history,
    { role: "user", content: message }
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let currentMessages = [...messages];

        // Agentic loop: keep going until no more tool calls
        while (true) {
          const response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            system: SYSTEM,
            tools: TOOLS,
            messages: currentMessages,
          });

          // Stream text blocks as they arrive (non-streaming API, send all at once)
          let textContent = "";
          let toolCalls = [];

          for (const block of response.content) {
            if (block.type === "text") {
              textContent += block.text;
            } else if (block.type === "tool_use") {
              toolCalls.push(block);
            }
          }

          if (textContent) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "text", text: textContent })}\n\n`
            ));
          }

          if (toolCalls.length === 0 || response.stop_reason === "end_turn") {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "done", text: textContent })}\n\n`
            ));
            break;
          }

          // Execute tools
          const toolResults = [];
          for (const tc of toolCalls) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "tool", name: tc.name, input: tc.input })}\n\n`
            ));
            const result = await executeTool(tc.name, tc.input);
            toolResults.push({
              type: "tool_result",
              tool_use_id: tc.id,
              content: result
            });
          }

          // Continue loop with tool results
          currentMessages = [
            ...currentMessages,
            { role: "assistant", content: response.content },
            { role: "user", content: toolResults }
          ];
        }
      } catch (err) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`
        ));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  });
}
