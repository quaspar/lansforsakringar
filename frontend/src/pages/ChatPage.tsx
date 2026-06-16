import { useEffect, useState } from "react";
import { createConversation, listConversations } from "../api/client";
import type { Conversation } from "../api/client";
import ChatView from "../components/ChatView";
import ConversationList from "../components/ConversationList";
import ModelPicker from "../components/ModelPicker";
import { useAuth } from "../auth/CognitoAuth";

const DEFAULT_MODEL = "anthropic.claude-3-haiku-20240307-v1:0";

export default function ChatPage() {
  const { logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newModel, setNewModel] = useState(DEFAULT_MODEL);
  const [showNewForm, setShowNewForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    try {
      const convs = await listConversations();
      setConversations(convs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    }
  }

  async function handleCreate() {
    const title = newTitle.trim() || "New Conversation";
    try {
      const conv = await createConversation(title, newModel);
      setConversations((prev) => [conv, ...prev]);
      setSelectedId(conv.id);
      setShowNewForm(false);
      setNewTitle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create conversation");
    }
  }

  const selectedConv = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-screen bg-gray-900">
      <ConversationList
        conversations={conversations}
        selected={selectedId}
        onSelect={setSelectedId}
        onNew={() => setShowNewForm(true)}
      />

      <div className="flex-1 flex flex-col">
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
          <div className="text-white font-semibold">
            {selectedConv ? selectedConv.title : "Select a conversation"}
          </div>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Sign out
          </button>
        </header>

        {error && (
          <div className="bg-red-900 text-red-200 text-sm px-6 py-2">
            {error}
          </div>
        )}

        {showNewForm && (
          <div className="bg-gray-800 border-b border-gray-700 p-4 flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-gray-400 text-xs mb-1 block">
                Title
              </label>
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="New Conversation"
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Model</label>
              <ModelPicker value={newModel} onChange={setNewModel} />
            </div>
            <button
              onClick={handleCreate}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {selectedConv ? (
            <ChatView
              conversationId={selectedConv.id}
              model={selectedConv.model}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">No conversation selected</p>
                <p className="text-sm">
                  Create a new conversation to get started.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
