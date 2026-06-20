import { useEffect, useRef, useState } from "react";
import type { Message } from "../api/client";
import { listMessages, sendMessage } from "../api/client";
import Composer from "./Composer";
import Markdown from "./Markdown";
import MessageActions from "./MessageActions";

interface Props {
  conversationId: string;
  model: string;
  initialMessage?: string | null;
  onInitialConsumed?: () => void;
  onCountChange?: (n: number) => void;
  onOpenModel?: () => void;
}

export default function ChatView({
  conversationId,
  model,
  initialMessage,
  onInitialConsumed,
  onCountChange,
  onOpenModel,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setStreamingContent("");
    setError(null);
    listMessages(conversationId)
      .then(setMessages)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Kunde inte hämta meddelanden")
      );
  }, [conversationId]);

  useEffect(() => {
    onCountChange?.(messages.length);
  }, [messages.length, onCountChange]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-send the first message when a conversation was just created.
  useEffect(() => {
    if (initialMessage && initialMessage.trim()) {
      void send(initialMessage);
      onInitialConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, initialMessage]);

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || streaming) return;
    setError(null);
    setStreaming(true);
    setStreamingContent("");
    setLastUserMessage(trimmed);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    let accumulated = "";
    try {
      for await (const token of sendMessage(conversationId, trimmed)) {
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
      setError(e instanceof Error ? e.message : "Kunde inte nå språkmodellen");
    } finally {
      setStreaming(false);
    }
  }

  function handleSend() {
    const content = input.trim();
    if (!content) return;
    setInput("");
    void send(content);
  }

  function regenerate() {
    if (lastUserMessage && !streaming) void send(lastUserMessage);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[768px] flex-col gap-7 px-4 pb-7 pt-[34px] sm:px-7">
          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <UserBubble key={msg.id} content={msg.content} />
            ) : (
              <AssistantMessage
                key={msg.id}
                content={msg.content}
                onRegenerate={regenerate}
                canRegenerate={i === messages.length - 1 && !streaming}
              />
            )
          )}

          {streaming && (
            <AssistantMessage content={streamingContent} streaming />
          )}

          {error && (
            <ErrorCard
              message={error}
              model={model}
              onRetry={() => lastUserMessage && void send(lastUserMessage)}
              onChangeModel={onOpenModel}
            />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="flex-none px-4 pb-[22px] pt-2.5 sm:px-7">
        <div className="mx-auto max-w-[768px]">
          <Composer
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={streaming}
            model={model}
          />
        </div>
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] whitespace-pre-wrap rounded-[16px_16px_5px_16px] border border-transparent bg-brand px-4 py-3 text-[14.5px] leading-[1.55] text-white shadow-[0_1px_2px_rgba(16,24,40,.06)]">
        {content}
      </div>
    </div>
  );
}

function AssistantMessage({
  content,
  streaming,
  onRegenerate,
  canRegenerate,
}: {
  content: string;
  streaming?: boolean;
  onRegenerate?: () => void;
  canRegenerate?: boolean;
}) {
  return (
    <div className="flex gap-3.5">
      <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-brand text-[14px] text-white shadow-[0_1px_2px_rgba(16,24,40,.18)]">
        ✦
      </div>
      <div className="min-w-0 pt-0.5">
        <div className="relative">
          <Markdown>{content}</Markdown>
          {streaming && (
            <span className="ml-0.5 inline-block h-[17px] w-2 animate-lfblink rounded-[1px] bg-brand align-[-3px]" />
          )}
        </div>
        {streaming ? (
          <div className="mt-3 inline-flex items-center gap-2.5 rounded-[10px] border border-[#e4e7ec] bg-[#f1f3f6] px-3 py-1.5">
            <span className="inline-flex gap-1">
              <span className="h-[5px] w-[5px] animate-lfdot rounded-full bg-brand" />
              <span className="h-[5px] w-[5px] animate-lfdot rounded-full bg-brand [animation-delay:.2s]" />
              <span className="h-[5px] w-[5px] animate-lfdot rounded-full bg-brand [animation-delay:.4s]" />
            </span>
            <span className="text-[12px] font-medium text-[#6b7480]">
              Genererar svar
            </span>
          </div>
        ) : (
          <MessageActions
            content={content}
            onRegenerate={onRegenerate}
            canRegenerate={canRegenerate}
          />
        )}
      </div>
    </div>
  );
}

function ErrorCard({
  message,
  model,
  onRetry,
  onChangeModel,
}: {
  message: string;
  model: string;
  onRetry: () => void;
  onChangeModel?: () => void;
}) {
  return (
    <div className="flex gap-3.5">
      <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-[#fbe9e3] text-[15px] text-[#c14724]">
        !
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-[14px] border border-[#f1d3c8] bg-[#fdf3ef] px-[18px] py-4">
          <div className="text-[14.5px] font-bold text-[#a23c1c]">
            Kunde inte nå språkmodellen
          </div>
          <div className="mt-1.5 text-[14px] leading-[1.6] text-[#8a5440]">
            {message}. Ditt meddelande är sparat i konversationen — ingenting
            gick förlorat. Försök igen eller byt till en annan modell.
          </div>
          <div className="mt-3.5 flex gap-2.5">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-[9px] bg-brand px-[15px] py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-strong"
            >
              ↻ Försök igen
            </button>
            {onChangeModel && (
              <button
                type="button"
                onClick={onChangeModel}
                className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#e2c4b8] bg-white px-[15px] py-2.5 text-[13px] font-semibold text-[#a23c1c]"
              >
                Byt modell
              </button>
            )}
          </div>
          <div className="mt-3 font-mono text-[11.5px] text-[#bd8b78]">
            upstream_error · {model}
          </div>
        </div>
      </div>
    </div>
  );
}
