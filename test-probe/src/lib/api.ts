interface Message {
  role: "user" | "assistant";
  content: string;
}

export const AVAILABLE_MODELS = [
  { id: "default", name: "Sonnet 5 (Default)" },
  { id: "claude-opus-5", name: "Opus 5 (Very Capable)" },
  { id: "claude-sonnet-5", name: "Sonnet 5 (Explicit)" },
  { id: "claude-haiku-4-5", name: "Haiku 4.5 (Fast)" },
];

export const DEFAULT_MODEL = "default";

export async function callClaude(messages: Message[], model: string = DEFAULT_MODEL): Promise<string> {
  try {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 2048,
        messages: messages,
      }),
    });

    const data = await response.json();
    console.log("API Response:", data);

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${data.error?.message || JSON.stringify(data)}`);
    }

    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error(`Unexpected API response format: ${JSON.stringify(data)}`);
    }

    return data.content[0].text;
  } catch (error) {
    console.error("Claude API Error:", error);
    throw error;
  }
}
