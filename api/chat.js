export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY environment variable" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const tab = body?.tab || "assistant";
    const model = body?.model || "gpt-5.4";
    const input = body?.input || "";
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    const instructionsMap = {
      assistant:
"You are a highly capable personal AI assistant. Be clear, practical, and intelligent. Give structured answers when helpful. Avoid generic advice.",

planner:
"You are an expert planner. Always break goals into steps, priorities, and next actions. Be specific and actionable.",

builder:
"You are a senior product engineer. When asked for features, include UI ideas, logic, and implementation steps."
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        instructions: instructionsMap[tab] || instructionsMap.assistant,
        input: [
          ...messages.map((m) => ({
            role: m.role === "ai" ? "assistant" : m.role,
            content: m.content
          })),
          {
            role: "user",
            content: input
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    let reply = data.output_text;

    if (!reply && Array.isArray(data.output)) {
      const texts = [];

      for (const item of data.output) {
        if (Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === "output_text" && part.text) {
              texts.push(part.text);
            } else if (part.type === "refusal" && part.refusal) {
              texts.push(part.refusal);
            }
          }
        }
      }

      reply = texts.join("\n").trim();
    }

    if (!reply) {
      return res.status(500).json({
        error: "No reply returned.",
        debug: data
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unknown server error"
    });
  }
}
