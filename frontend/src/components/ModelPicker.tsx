import { MODELS, modelDot, modelLabel } from "../lib/models";

interface Props {
  value: string;
  onChange: (model: string) => void;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export default function ModelPicker({
  value,
  onChange,
  open,
  onToggle,
  onClose,
}: Props) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-2.5 rounded-[10px] border border-line-strong bg-white px-3 py-1.5 text-[13px] font-semibold transition hover:border-[#cfd4dc] hover:shadow-sm"
      >
        <span
          className="h-2 w-2 flex-none rounded-full"
          style={{ background: modelDot(value) }}
        />
        {modelLabel(value)}
        <span className="ml-px text-[11px] text-ink-faint">▾</span>
      </button>

      {open && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-20" onClick={onClose} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[330px] overflow-hidden rounded-[14px] border border-line-strong bg-white shadow-[0_16px_44px_rgba(16,24,40,.20)]">
            <div className="border-b border-[#f0f1f4] px-4 pb-2 pt-[11px] text-[11px] font-bold tracking-[.06em] text-ink-faint">
              VÄLJ MODELL
            </div>
            <div className="p-1.5">
              <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-bold tracking-[.05em] text-ink-faint">
                ANTHROPIC
              </div>
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    onClose();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition hover:bg-[#f4f6f8]"
                >
                  <span
                    className="h-2 w-2 flex-none rounded-full"
                    style={{ background: m.dot }}
                  />
                  <div className="flex-1">
                    <div className="text-[13.5px] font-semibold">{m.label}</div>
                    <div className="text-[11.5px] text-ink-faint">
                      {m.description}
                    </div>
                  </div>
                  {value === m.id && (
                    <span className="font-bold text-brand">✓</span>
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-[#f0f1f4] px-4 py-2.5 text-[11.5px] text-ink-faint">
              Bytet gäller från nästa konversation. Historiken behålls.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
