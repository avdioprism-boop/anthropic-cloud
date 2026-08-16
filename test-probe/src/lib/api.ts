interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeReply {
  text: string;
  reasoning: string | null;
}

export interface ModelOption {
  id: string;
  name: string;
}

export interface ChatConfig {
  models: ModelOption[];
  defaultModel: string;
  reasoningEnabledByDefault: boolean;
}

// Used until /api/config responds, and as a fallback if it cannot be reached.
export const FALLBACK_CONFIG: ChatConfig = {
  models: [
    { id: "claude-opus-5", name: "Opus 5 (Default - Most Capable)" },
    { id: "claude-sonnet-5", name: "Sonnet 5 (Balanced)" },
    { id: "claude-haiku-4-5", name: "Haiku 4.5 (Fast)" },
  ],
  defaultModel: "claude-opus-5",
  reasoningEnabledByDefault: true,
};

export const DEFAULT_MODEL = FALLBACK_CONFIG.defaultModel;

export async function fetchConfig(): Promise<ChatConfig> {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) throw new Error(`Config request failed: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Falling back to built-in config:", error);
    return FALLBACK_CONFIG;
  }
}

export async function callClaude(
  messages: Message[],
  model: string = DEFAULT_MODEL,
  reasoning: boolean = true
): Promise<ClaudeReply> {
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
        reasoning: reasoning,
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

    return { text: data.content[0].text, reasoning: data.reasoning ?? null };
  } catch (error) {
    console.error("Claude API Error:", error);
    throw error;
  }
}
