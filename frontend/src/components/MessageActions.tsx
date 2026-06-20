import { useState } from "react";

interface Props {
  content: string;
  onRegenerate?: () => void;
  canRegenerate?: boolean;
}

/**
 * Client-side message actions. Copy and Regenerate need no backend support
 * (regenerate re-sends the previous user message). The prototype's thumbs
 * up/down are omitted because there is no feedback-persistence endpoint.
 */
export default function MessageActions({
  content,
  onRegenerate,
  canRegenerate,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  const pill =
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[#7d8794] transition hover:bg-[#f3f4f6]";

  return (
    <div className="mt-3.5 flex items-center gap-1">
      <button type="button" onClick={copy} className={pill}>
        ⧉ {copied ? "Kopierat" : "Kopiera"}
      </button>
      {canRegenerate && onRegenerate && (
        <button type="button" onClick={onRegenerate} className={pill}>
          ↻ Regenerera
        </button>
      )}
    </div>
  );
}
