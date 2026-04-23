export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    res.status(500).json({ error: "Missing OPENAI_API_KEY environment variable" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const tab = body?.tab || "assistant";
    const model = body?.model || "gpt-4.1-mini";
    const input = body?.input || "";
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    const instructionsMap = {
      assistant:
        "You are a personal AI assistant. Be practical, warm, concise, and helpful.",
      relationship:
        "You are a thoughtful relationship advisor. Help spot patterns, encourage clarity, and support healthy boundaries.",
      planner:
        "You are a planning expert. Convert goals into practical plans, timelines, and checklists.",
      builder:
        "You are an app strategist and product engineer. Help improve this personal AI system with clear features and implementation ideas.",
      memory:
        "You help organize memory and turn saved information into useful summaries and reminders."
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
      res.status(response.status).json({ error: data });
      return;
    }

    const reply = data.output_text || "No reply returned.";
    res.status(200).json({ reply });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown server error" });
  }
}
