const MODEL = "claude-sonnet-5";

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
