import React, { useEffect, useRef, useState } from "react";
import type { Message } from "../api/client";
import { listMessages, sendMessage } from "../api/client";

interface Props {
  conversationId: string;
  model: string;
}

export default function ChatView({ conversationId, model }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setStreamingContent("");
    setError(null);
    listMessages(conversationId)
      .then(setMessages)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load messages")
      );
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  async function handleSend() {
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    setError(null);
    setStreaming(true);
    setStreamingContent("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    let accumulated = "";
    try {
      for await (const token of sendMessage(conversationId, content)) {
        accumulated += token;
        setStreamingContent(accumulated);
      }
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: accumulated,
        model,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingContent("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-800">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {streamingContent && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-white rounded-2xl rounded-tl-sm px-4 py-3 max-w-2xl whitespace-pre-wrap">
              {streamingContent}
              <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1" />
            </div>
          </div>
        )}
        {error && (
          <div className="text-red-400 text-sm text-center">{error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={streaming}
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg px-6 py-3 font-medium transition-colors"
          >
            {streaming ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`rounded-2xl px-4 py-3 max-w-2xl whitespace-pre-wrap text-sm ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-sm"
            : "bg-gray-700 text-white rounded-tl-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
