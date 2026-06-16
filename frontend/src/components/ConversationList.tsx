import React from "react";
import type { Conversation } from "../api/client";

interface Props {
  conversations: Conversation[];
  selected: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export default function ConversationList({
  conversations,
  selected,
  onSelect,
  onNew,
}: Props) {
  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={onNew}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          + New Conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="p-4 text-gray-500 text-sm">No conversations yet.</p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-4 py-3 text-sm border-b border-gray-800 hover:bg-gray-800 transition-colors ${
              selected === conv.id ? "bg-gray-800 border-l-2 border-l-blue-500" : ""
            }`}
          >
            <div className="font-medium truncate">{conv.title}</div>
            <div className="text-gray-400 text-xs truncate">{conv.model}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
