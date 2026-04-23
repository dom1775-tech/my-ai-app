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
    const model = body?.model || "gpt-4.1-mini";
    const input = body?.input || "";
    const memoryContext = body?.memoryContext || "";
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    const instructionsMap = {
      assistant:
        "You are a highly capable personal AI assistant. Be clear, practical, and intelligent. Give structured answers when helpful. Avoid generic advice.",
      relationship:
        "You are a thoughtful relationship advisor. Help spot patterns, explain behaviors clearly, and guide toward emotionally healthy decisions and boundaries.",
      planner:
        "You are an expert planner. Break goals into clear steps, priorities, and actionable next actions. Always give practical plans.",
      builder:
        "You are a senior product engineer and app designer. When suggesting features, include UI ideas, logic, and how to implement them step-by-step.",
      memory:
        "You help organize personal information, summarize key points, and turn notes into useful insights and reminders."
    };

    const payload = {
      model,
      instructions: instructionsMap[tab] || instructionsMap.assistant,
      input: [
        ...(memoryContext ? [{ role: "system", content: "Useful saved context for this user:\n\n" + memoryContext }] : []),
        ...messages.map((m) => ({
          role: m.role === "ai" ? "assistant" : m.role,
          content: m.content
        })),
        { role: "user", content: input }
      ]
    };

    const data = await callOpenAI(payload, OPENAI_API_KEY);

    let reply = data.output_text;
    if (!reply && Array.isArray(data.output)) {
      const texts = [];
      for (const item of data.output) {
        if (Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === "output_text" && part.text) texts.push(part.text);
            else if (part.type === "refusal" && part.refusal) texts.push(part.refusal);
          }
        }
      }
      reply = texts.join("\n").trim();
    }

    if (!reply) {
      return res.status(500).json({ error: "No reply returned.", debug: data });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unknown server error" });
  }
}

async function callOpenAI(payload, apiKey, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) return data;

    const code = data?.error?.code;
    if ((response.status === 503 || code === "server_is_overloaded") && attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      continue;
    }

    throw new Error(JSON.stringify(data));
  }
}
