import { useMemo, useState } from "react";
import type { Conversation } from "../api/client";
import { groupByDate, initials, displayName } from "../lib/format";
import { modelLabel } from "../lib/models";

interface Props {
  conversations: Conversation[];
  selected: string | null;
  email: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onToggleSidebar: () => void;
  onSignOut: () => void;
}

export default function ConversationList({
  conversations,
  selected,
  email,
  onSelect,
  onNew,
  onToggleSidebar,
  onSignOut,
}: Props) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? conversations.filter((c) => c.title.toLowerCase().includes(q))
      : conversations;
    return groupByDate(filtered);
  }, [conversations, query]);

  return (
    <div className="flex h-full w-[284px] flex-none flex-col border-r border-line bg-panel">
      {/* header */}
      <div className="flex items-center justify-between gap-2.5 px-4 pb-3.5 pt-4">
        <div className="flex min-w-0 items-center gap-[11px]">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-brand shadow-[0_1px_2px_rgba(16,24,40,.18)]">
            <div className="h-[11px] w-[11px] rotate-45 rounded-[2px] bg-white" />
          </div>
          <div className="flex min-w-0 flex-col leading-[1.05]">
            <div className="text-[15px] font-bold tracking-[-.01em]">
              Assistenten
            </div>
            <div className="text-[11px] text-ink-muted">Försäkring &amp; bank</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleSidebar}
          title="Dölj sidopanel"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[#7d8794] transition hover:bg-[#e9ebef]"
        >
          <SidebarIcon />
        </button>
      </div>

      {/* new conversation */}
      <div className="px-3.5 pb-3 pt-1">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2.5 rounded-[11px] bg-brand px-3 py-[11px] text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,.12)] transition hover:bg-brand-strong"
        >
          <span className="-mt-px text-[16px] leading-none">＋</span> Ny
          konversation
        </button>
      </div>

      {/* search */}
      <div className="px-3.5 pb-3">
        <div className="flex items-center gap-2.5 rounded-[10px] border border-line-strong bg-white px-3 py-2.5">
          <span className="text-[14px] text-ink-faint">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök i konversationer"
            className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-3 pt-1">
        {conversations.length === 0 && (
          <p className="px-2 py-3 text-[12.5px] text-ink-faint">
            Inga konversationer än.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.bucket}>
            <div className="px-2 pb-1.5 pt-2.5 text-[11px] font-bold tracking-[.06em] text-ink-faint">
              {group.bucket}
            </div>
            {group.conversations.map((conv) => {
              const active = selected === conv.id;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => onSelect(conv.id)}
                  className={
                    "relative mb-[5px] w-full rounded-[10px] px-3 py-2.5 text-left transition " +
                    (active
                      ? "border border-line-strong bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]"
                      : "hover:bg-[#eef0f4]")
                  }
                >
                  {active && (
                    <div className="absolute bottom-[9px] left-0 top-[9px] w-[3px] rounded-[3px] bg-brand" />
                  )}
                  <div
                    className={
                      "ml-[5px] truncate text-[13px] " +
                      (active ? "font-semibold" : "font-medium text-ink-soft")
                    }
                  >
                    {conv.title}
                  </div>
                  <div className="ml-[5px] truncate text-[11.5px] text-ink-faint">
                    {modelLabel(conv.model)}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* profile footer */}
      <div className="flex items-center gap-[11px] border-t border-line px-3.5 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dde7f4] text-[12.5px] font-bold text-brand-strong">
          {initials(email)}
        </div>
        <div className="flex-1 leading-[1.15]">
          <div className="text-[13px] font-semibold">{displayName(email)}</div>
          <div className="text-[11px] text-ink-faint">Privatkund</div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          title="Logga ut"
          className="flex h-[30px] items-center justify-center rounded-lg px-2.5 text-[12px] font-semibold text-[#7d8794] transition hover:bg-[#e9ebef]"
        >
          Logga ut
        </button>
      </div>
    </div>
  );
}

function SidebarIcon() {
  return (
    <div className="relative h-[14px] w-[17px] rounded-[3px] border-[1.6px] border-current">
      <div className="absolute bottom-px left-[5px] top-px w-[1.6px] bg-current" />
    </div>
  );
}
