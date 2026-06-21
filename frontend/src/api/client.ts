const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("id_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const devSub = import.meta.env.VITE_DEV_SUB;
  if (devSub) {
    return { "X-Dev-Sub": devSub };
  }
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const resp = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (resp.status === 401) {
    localStorage.removeItem("id_token");
    window.location.href = "/login";
  }
  return resp;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  created_at: string;
}

export async function listConversations(): Promise<Conversation[]> {
  const resp = await apiFetch("/conversations");
  if (!resp.ok) throw new Error("Failed to load conversations");
  return resp.json();
}

export async function createConversation(
  title: string,
  model: string
): Promise<Conversation> {
  const resp = await apiFetch("/conversations", {
    method: "POST",
    body: JSON.stringify({ title, model }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err?.error?.message ?? "Failed to create conversation");
  }
  return resp.json();
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const resp = await apiFetch(`/conversations/${conversationId}/messages`);
  if (!resp.ok) throw new Error("Failed to load messages");
  return resp.json();
}

export async function* sendMessage(
  conversationId: string,
  content: string,
  model?: string
): AsyncGenerator<string> {
  const resp = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(model ? { content, model } : { content }),
  });

  if (!resp.ok || !resp.body) {
    throw new Error("Failed to send message");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line. Parse whole events only;
    // a token may span multiple `data:` lines (one per embedded newline),
    // which must be rejoined with "\n" to reconstruct the original content.
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let eventName: string | null = null;
      const dataLines: string[] = [];
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          // Strip "data:" and the single optional leading space (SSE convention).
          const v = line.slice(5);
          dataLines.push(v.startsWith(" ") ? v.slice(1) : v);
        }
      }

      if (eventName === "error") {
        throw new Error("upstream_error");
      }
      if (eventName === "done") {
        return;
      }
      if (dataLines.length > 0) {
        yield dataLines.join("\n");
      }
    }
  }
}
