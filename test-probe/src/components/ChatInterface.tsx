import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  callClaude,
  fetchConfig,
  FALLBACK_CONFIG,
  type ChatConfig,
} from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  reasoning?: string | null;
}

function ReasoningPanel({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-2 border-b border-border/50 pb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span
          className={`inline-block transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>
        {open ? "Hide reasoning" : "Show reasoning"}
      </button>
      {open && (
        <p className="mt-2 text-xs italic text-muted-foreground whitespace-pre-wrap">
          {reasoning}
        </p>
      )}
    </div>
  );
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ChatConfig>(FALLBACK_CONFIG);
  const [model, setModel] = useState(FALLBACK_CONFIG.defaultModel);
  const [reasoningOn, setReasoningOn] = useState(
    FALLBACK_CONFIG.reasoningEnabledByDefault
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConfig().then((loaded) => {
      setConfig(loaded);
      setModel(loaded.defaultModel);
      setReasoningOn(loaded.reasoningEnabledByDefault);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const reply = await callClaude(newMessages, model, reasoningOn);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: reply.text,
          reasoning: reply.reasoning,
        },
      ]);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error occurred";
      setMessages([
        ...newMessages,
        { role: "assistant", content: `Error: ${errorMsg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="border-b p-4 bg-background">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold">Claude Chat</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={reasoningOn}
                onChange={(e) => setReasoningOn(e.target.checked)}
                disabled={loading}
                className="accent-primary"
              />
              Reasoning
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
              className="px-3 py-2 bg-muted text-foreground border border-border rounded-md text-sm disabled:opacity-50"
            >
              {config.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Chat with Claude</h2>
                  <p>Start a conversation using {config.models.find(m => m.id === model)?.name}</p>
                </div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <Card
                  className={`max-w-xs lg:max-w-md px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.reasoning && <ReasoningPanel reasoning={msg.reasoning} />}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </Card>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <Card className="bg-muted px-4 py-2">
                  <p className="text-sm text-muted-foreground">
                    Claude is thinking...
                  </p>
                </Card>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="border-t p-4 bg-background">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1 bg-muted text-foreground"
          />
          <Button onClick={handleSend} disabled={loading}>
            {loading ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
