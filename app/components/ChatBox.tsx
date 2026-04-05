"use client";

/**
 * ChatBox component — the main UI for natural language
 * real estate queries. Handles message state, API calls,
 * loading states, and quick query buttons.
 */

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QUICK_QUERIES } from "@/app/lib/prompts";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]); // Past user prompts
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 = not browsing history
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /**
   * Send a query to the API and append the response to chat history.
   */
  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // Add user message to chat and history
    const userMsg: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json();

      // Handle rate limit or server errors
      if (!res.ok) {
        const errorText = data.error || "系統發生錯誤，請稍後再試";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: errorText },
        ]);
        return;
      }

      // Append AI response
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "無法連線至伺服器，請檢查網路連線。" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Handle Enter to submit, Shift+Enter for newline.
   */
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl+Enter or Cmd+Enter to submit; plain Enter for newline
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendMessage(input);
      return;
    }

    // ArrowUp: browse prompt history (only when input is empty or already browsing)
    if (e.key === "ArrowUp" && history.length > 0) {
      // Only activate when cursor is at the start (no text above)
      const textarea = e.currentTarget;
      if (textarea.selectionStart === 0) {
        e.preventDefault();
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    }

    // ArrowDown: browse forward in history
    if (e.key === "ArrowDown" && historyIndex !== -1) {
      const textarea = e.currentTarget;
      if (textarea.selectionStart === textarea.value.length) {
        e.preventDefault();
        if (historyIndex >= history.length - 1) {
          // Past the end — clear back to empty input
          setHistoryIndex(-1);
          setInput("");
        } else {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
      }
    }
  }

  // Show welcome screen when no messages and not loading
  const showWelcome = messages.length === 0 && !loading;

  return (
    <Card className="flex flex-col h-[600px] max-w-2xl w-full mx-auto">
      {/* Chat messages area — plain div with overflow-y-auto for reliable scrolling */}
      <div className="flex-1 overflow-y-auto p-4">
        {showWelcome ? (
          /* Welcome screen */
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div>
              <h2 className="text-xl font-semibold mb-2">
                歡迎使用實價登錄 AI 查詢
              </h2>
              <p className="text-muted-foreground text-sm">
                用自然語言查詢台灣不動產成交資料，例如「大安區兩房公寓均價」
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_QUERIES.map((q) => (
                <Button
                  key={q.label}
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage(q.query)}
                >
                  {q.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2 text-sm">
                  <span className="animate-pulse">AI 正在查詢中...</span>
                </div>
              </div>
            )}

            {/* Invisible anchor for auto-scroll */}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Quick queries (shown when there are messages and not loading) */}
      {!showWelcome && !loading && (
        <div className="flex flex-wrap gap-1 px-4 pb-2">
          {QUICK_QUERIES.map((q) => (
            <Button
              key={q.label}
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => sendMessage(q.query)}
            >
              {q.label}
            </Button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2 p-4 border-t items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="輸入您的查詢，例如：大安區兩房公寓均價（Ctrl+Enter 送出）"
          disabled={loading}
          rows={2}
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
          {loading ? "查詢中" : "送出"}
        </Button>
      </div>
    </Card>
  );
}
