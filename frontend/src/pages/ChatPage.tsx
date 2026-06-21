import { useCallback, useEffect, useState } from "react";
import { createConversation, listConversations } from "../api/client";
import type { Conversation } from "../api/client";
import ChatView from "../components/ChatView";
import ConversationList from "../components/ConversationList";
import EmptyState from "../components/EmptyState";
import ModelPicker from "../components/ModelPicker";
import { useAuth } from "../auth/CognitoAuth";
import { useIsMobile } from "../lib/useMediaQuery";
import { deriveTitle, displayName } from "../lib/format";
import { DEFAULT_MODEL, modelLabel } from "../lib/models";

export default function ChatPage() {
  const { logout, email } = useAuth();
  const isMobile = useIsMobile();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(true);
  const [draftModel, setDraftModel] = useState(DEFAULT_MODEL);
  const [draftInput, setDraftInput] = useState("");
  const [pendingInitial, setPendingInitial] = useState<string | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [messageCount, setMessageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    try {
      setConversations(await listConversations());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte hämta konversationer");
    }
  }

  const selectedConv = conversations.find((c) => c.id === selectedId);
  // The model picker (draftModel) is the source of truth for the model used on
  // the next message — both for new conversations and for switching models
  // mid-conversation. Selecting a conversation seeds the picker with the model
  // it was created with.
  const effectiveModel = draftModel;
  const showEmpty = composing || !selectedConv;

  function handleSelect(id: string) {
    setSelectedId(id);
    const conv = conversations.find((c) => c.id === id);
    if (conv) setDraftModel(conv.model);
    setComposing(false);
    setPendingInitial(null);
    setModelOpen(false);
    if (isMobile) setSidebarOpen(false);
  }

  function handleNew() {
    setComposing(true);
    setSelectedId(null);
    setDraftInput("");
    setModelOpen(false);
    if (isMobile) setSidebarOpen(false);
  }

  async function handleSendFromEmpty() {
    const content = draftInput.trim();
    if (!content) return;
    try {
      const conv = await createConversation(deriveTitle(content), draftModel);
      setConversations((prev) => [conv, ...prev]);
      setPendingInitial(content);
      setSelectedId(conv.id);
      setComposing(false);
      setDraftInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte skapa konversation");
    }
  }

  const onCountChange = useCallback((n: number) => setMessageCount(n), []);

  const title = showEmpty ? "Ny konversation" : selectedConv!.title;
  const subtitle = showEmpty
    ? "Välj ett förslag eller skriv en fråga"
    : `${modelLabel(effectiveModel)} · ${messageCount} meddelanden`;
  const showMainToggle = isMobile || !sidebarOpen;

  const sidebar = (
    <ConversationList
      conversations={conversations}
      selected={selectedId}
      email={email}
      onSelect={handleSelect}
      onNew={handleNew}
      onToggleSidebar={() => setSidebarOpen((v) => !v)}
      onSignOut={logout}
    />
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-ink">
      {/* sidebar */}
      {isMobile ? (
        <>
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-[39] bg-[rgba(16,22,30,.42)]"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <div
            className={
              "fixed inset-y-0 left-0 z-40 transition-transform duration-200 " +
              (sidebarOpen
                ? "translate-x-0 shadow-[0_12px_44px_rgba(16,24,40,.30)]"
                : "-translate-x-full")
            }
          >
            {sidebar}
          </div>
        </>
      ) : (
        sidebarOpen && sidebar
      )}

      {/* main */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <div className="relative z-10 flex h-[62px] flex-none items-center justify-between border-b border-[#eceef1] bg-white/85 px-4 backdrop-blur sm:px-[22px]">
          <div className="flex min-w-0 items-center gap-3">
            {showMainToggle && (
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                title="Visa sidopanel"
                className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] border border-line-strong bg-white text-[#5b6672] transition hover:bg-[#f3f4f6]"
              >
                <div className="relative h-[14px] w-[17px] rounded-[3px] border-[1.6px] border-current">
                  <div className="absolute bottom-px left-[5px] top-px w-[1.6px] bg-current" />
                </div>
              </button>
            )}
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold tracking-[-.01em]">
                {title}
              </div>
              <div className="text-[11.5px] text-ink-faint">{subtitle}</div>
            </div>
          </div>
          <ModelPicker
            value={effectiveModel}
            onChange={setDraftModel}
            open={modelOpen}
            onToggle={() => setModelOpen((v) => !v)}
            onClose={() => setModelOpen(false)}
          />
        </div>

        {error && (
          <div className="bg-[#fdf3ef] px-6 py-2 text-[13px] text-[#a23c1c]">
            {error}
          </div>
        )}

        {showEmpty ? (
          <EmptyState
            name={displayName(email)}
            model={effectiveModel}
            input={draftInput}
            onChange={setDraftInput}
            onSend={handleSendFromEmpty}
          />
        ) : (
          <ChatView
            key={selectedConv!.id}
            conversationId={selectedConv!.id}
            model={effectiveModel}
            initialMessage={pendingInitial}
            onInitialConsumed={() => setPendingInitial(null)}
            onCountChange={onCountChange}
            onOpenModel={() => setModelOpen(true)}
          />
        )}
      </div>
    </div>
  );
}
