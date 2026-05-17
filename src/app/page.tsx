"use client";

import { useReducer, useState, useRef, useEffect, useCallback } from "react";
import GenreSelector from "@/components/GenreSelector";
import ChatWindow from "@/components/ChatWindow";
import ThemeToggle from "@/components/ThemeToggle";
import { Genre, buildSystemPrompt, GENRE_LABELS } from "@/lib/prompts";
import type { Message } from "@/components/MessageBubble";

// --- reducer ---

type Action =
  | { type: "ADD_USER"; content: string }
  | { type: "ADD_ASSISTANT_STREAMING" }
  | { type: "APPEND_CHUNK"; chunk: string }
  | { type: "FINISH_STREAMING" }
  | { type: "RESET" };

function messagesReducer(state: Message[], action: Action): Message[] {
  switch (action.type) {
    case "ADD_USER":
      return [...state, { role: "user", content: action.content }];
    case "ADD_ASSISTANT_STREAMING":
      return [...state, { role: "assistant", content: "", streaming: true }];
    case "APPEND_CHUNK": {
      const last = state[state.length - 1];
      if (!last || last.role !== "assistant") return state;
      return [
        ...state.slice(0, -1),
        { ...last, content: last.content + action.chunk },
      ];
    }
    case "FINISH_STREAMING": {
      const last = state[state.length - 1];
      if (!last || last.role !== "assistant") return state;
      return [...state.slice(0, -1), { ...last, streaming: false }];
    }
    case "RESET":
      return [];
    default:
      return state;
  }
}

// --- page ---

type Phase = "select" | "chat";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("select");
  const [messages, dispatch] = useReducer(messagesReducer, []);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [genre, setGenre] = useState<Genre | null>(null);
  const systemPromptRef = useRef<string>("");

  function handleStart(selectedGenre: Genre, setting: string) {
    systemPromptRef.current = buildSystemPrompt(selectedGenre, setting);
    setGenre(selectedGenre);
    setPhase("chat");
  }

  // フェーズが chat になったら Claude に物語の冒頭を自動生成させる
  const startStory = useCallback(async (sysPrompt: string) => {
    setIsStreaming(true);
    dispatch({ type: "ADD_ASSISTANT_STREAMING" });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "物語を始めてください。" }],
          systemPrompt: sysPrompt,
        }),
      });
      if (!res.ok || !res.body) {
        dispatch({ type: "APPEND_CHUNK", chunk: "エラーが発生しました。もう一度お試しください。" });
        dispatch({ type: "FINISH_STREAMING" });
        setIsStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        dispatch({ type: "APPEND_CHUNK", chunk: decoder.decode(value, { stream: true }) });
      }
    } catch {
      dispatch({ type: "APPEND_CHUNK", chunk: "通信エラーが発生しました。" });
    } finally {
      dispatch({ type: "FINISH_STREAMING" });
      setIsStreaming(false);
    }
  }, []);

  useEffect(() => {
    if (phase === "chat" && systemPromptRef.current) {
      startStory(systemPromptRef.current);
    }
    // phase が chat に変わったときだけ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function sendMessage(content: string) {
    if (!content.trim() || isStreaming) return;

    const userMessage: Message = { role: "user", content: content.trim() };
    dispatch({ type: "ADD_USER", content: content.trim() });
    setInput("");
    setIsStreaming(true);
    dispatch({ type: "ADD_ASSISTANT_STREAMING" });

    try {
      // 送信用履歴（ADD_USER 直後のものを手動合成）
      const history: Message[] = [
        ...messages,
        userMessage,
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          systemPrompt: systemPromptRef.current,
        }),
      });

      if (!res.ok || !res.body) {
        dispatch({ type: "APPEND_CHUNK", chunk: "エラーが発生しました。もう一度お試しください。" });
        dispatch({ type: "FINISH_STREAMING" });
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        dispatch({ type: "APPEND_CHUNK", chunk: decoder.decode(value, { stream: true }) });
      }
    } catch {
      dispatch({ type: "APPEND_CHUNK", chunk: "通信エラーが発生しました。" });
    } finally {
      dispatch({ type: "FINISH_STREAMING" });
      setIsStreaming(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleReset() {
    dispatch({ type: "RESET" });
    setPhase("select");
    setGenre(null);
    setInput("");
  }

  // --- ジャンル選択画面 ---
  if (phase === "select") {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="flex justify-end p-3">
          <ThemeToggle />
        </header>
        <main className="flex-1 flex items-center justify-center">
          <GenreSelector onStart={handleStart} />
        </main>
      </div>
    );
  }

  // --- チャット画面 ---
  return (
    <div className="flex flex-col h-screen">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10 shrink-0">
        <button
          onClick={handleReset}
          className="text-xs opacity-50 hover:opacity-80 transition-opacity"
        >
          ← ジャンル選択に戻る
        </button>
        <span className="text-sm font-medium">
          {genre ? GENRE_LABELS[genre] : "Story Chat — AIと紡ぐ物語！！"}
        </span>
        <ThemeToggle />
      </header>

      {/* メッセージ一覧 */}
      <ChatWindow messages={messages} />

      {/* 入力フォーム */}
      <div className="shrink-0 border-t border-black/10 dark:border-white/10 px-3 py-3 sm:px-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto flex gap-2 items-end"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={isStreaming ? "物語を生成中...！！！" : "行動や言葉を入力…（Enter で送信）"}
            rows={2}
            className="flex-1 resize-none rounded-xl border border-black/10 dark:border-white/10
              bg-black/5 dark:bg-white/5 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500
              disabled:opacity-40 placeholder:opacity-30"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="shrink-0 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium
              transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            送信!!!
          </button>
        </form>
      </div>
    </div>
  );
}
