const MODEL = "claude-opus-5";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function callClaude(messages: Message[]): Promise<string> {
  try {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error ${response.status}: ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error("Claude API Error:", error);
    throw error;
  }
}
