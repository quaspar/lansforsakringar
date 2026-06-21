import React from "react";
import { modelLabel } from "../lib/models";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  model: string;
  placeholder?: string;
  /** Show the helper row beneath the input (active chat); hidden in some states. */
  showHints?: boolean;
}

export default function Composer({
  value,
  onChange,
  onSend,
  disabled,
  model,
  placeholder = "Skriv ett meddelande till assistenten…",
  showHints = true,
}: Props) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  }

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div>
      <div className="rounded-[18px] border border-line-input bg-white px-3 pb-2.5 pl-4 pt-3 shadow-[0_2px_10px_rgba(16,24,40,.06)]">
        <div className="flex items-end gap-3">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[14.5px] leading-[1.5] text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Bifoga"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[18px] text-[#7d8794] transition hover:bg-[#f3f4f6]"
            >
              ＋
            </button>
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              title="Skicka"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-brand text-[17px] text-white shadow-[0_1px_3px_rgba(16,24,40,.18)] transition hover:bg-brand-strong disabled:opacity-40"
            >
              ↑
            </button>
          </div>
        </div>
      </div>
      {showHints && (
        <div className="mt-2.5 flex items-center justify-between px-1.5">
          <span className="text-[11.5px] text-ink-faint">
            LeiF kan ha fel. Kontrollera viktig information.
          </span>
          <span className="text-[11.5px] text-ink-faint">
            {modelLabel(model)} · Enter skickar
          </span>
        </div>
      )}
    </div>
  );
}
