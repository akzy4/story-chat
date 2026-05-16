"use client";

import { useReducer, useState, useRef, useEffect, useCallback } from "react";
import GenreSelector from "@/components/GenreSelector";
import ChatWindow from "@/components/ChatWindow";
import ThemeToggle from "@/components/ThemeToggle";
import { Genre, buildSystemPrompt, GENRE_LABELS } from "@/lib/prompts";
import type { Message, ImageAttachment } from "@/components/MessageBubble";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// --- reducer ---

type Action =
  | { type: "ADD_USER"; content: string; images?: ImageAttachment[] }
  | { type: "ADD_ASSISTANT_STREAMING" }
  | { type: "APPEND_CHUNK"; chunk: string }
  | { type: "FINISH_STREAMING" }
  | { type: "RESET" };

function messagesReducer(state: Message[], action: Action): Message[] {
  switch (action.type) {
    case "ADD_USER":
      return [...state, { role: "user", content: action.content, images: action.images }];
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
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const systemPromptRef = useRef<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleStart(selectedGenre: Genre, setting: string) {
    systemPromptRef.current = buildSystemPrompt(selectedGenre, setting);
    setGenre(selectedGenre);
    setPhase("chat");
  }

  // 画像ファイルを base64 に変換して pendingImages に追加
  async function addImages(files: FileList | File[]) {
    setImageError(null);
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setImageError("未対応の形式です（JPEG / PNG / GIF / WEBP のみ対応）");
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setImageError("5MB を超えるファイルは添付できません");
        continue;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1];
      setPendingImages((prev) => [
        ...prev,
        { data: base64, mediaType: file.type as ImageAttachment["mediaType"] },
      ]);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addImages(e.target.files);
      e.target.value = "";
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addImages(e.dataTransfer.files);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const imageFiles = Array.from(e.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (imageFiles.length > 0) {
      addImages(imageFiles);
    }
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

  async function sendMessage(content: string, images: ImageAttachment[]) {
    if (!content.trim() && images.length === 0) return;
    if (isStreaming) return;

    const userMessage: Message = { role: "user", content: content.trim(), images };
    dispatch({ type: "ADD_USER", content: content.trim(), images });
    setInput("");
    setPendingImages([]);
    setImageError(null);
    setIsStreaming(true);
    dispatch({ type: "ADD_ASSISTANT_STREAMING" });

    try {
      const history = [...messages, userMessage].map(({ role, content, images }) => ({
        role,
        content,
        ...(images && images.length > 0 ? { images } : {}),
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
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
    sendMessage(input, pendingImages);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input, pendingImages);
    }
  }

  function handleReset() {
    dispatch({ type: "RESET" });
    setPhase("select");
    setGenre(null);
    setInput("");
    setPendingImages([]);
    setImageError(null);
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
          {genre ? GENRE_LABELS[genre] : "Story Chat"}
        </span>
        <ThemeToggle />
      </header>

      {/* メッセージ一覧 */}
      <ChatWindow messages={messages} />

      {/* 入力フォーム */}
      <div
        className={`shrink-0 border-t border-black/10 dark:border-white/10 px-3 py-3 sm:px-4 transition-colors
          ${isDragging ? "bg-indigo-50 dark:bg-indigo-950/20" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          {/* 添付画像プレビュー */}
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingImages.map((img, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${img.mediaType};base64,${img.data}`}
                    alt={`添付画像 ${i + 1}`}
                    className="h-16 w-16 rounded-lg object-cover border border-black/10 dark:border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center hover:bg-black/80"
                    aria-label={`添付画像 ${i + 1} を削除`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* エラーメッセージ */}
          {imageError && (
            <p className="text-xs text-red-500">{imageError}</p>
          )}

          {/* ドラッグ&ドロップ案内 */}
          {isDragging && (
            <p className="text-xs text-indigo-500 text-center py-1">
              ここにドロップして画像を添付
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            {/* ファイル添付ボタン */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              title="画像を添付（JPEG / PNG / GIF / WEBP・最大 5MB）"
              aria-label="画像を添付"
              className="shrink-0 h-10 w-10 rounded-xl border border-black/10 dark:border-white/10
                bg-black/5 dark:bg-white/5 flex items-center justify-center text-base
                hover:bg-black/10 dark:hover:bg-white/10 transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              📎
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={isStreaming}
              placeholder={isStreaming ? "物語を生成中..." : "行動や言葉を入力…（Enter で送信）"}
              rows={2}
              className="flex-1 resize-none rounded-xl border border-black/10 dark:border-white/10
                bg-black/5 dark:bg-white/5 px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500
                disabled:opacity-40 placeholder:opacity-30"
            />

            <button
              type="submit"
              disabled={isStreaming || (!input.trim() && pendingImages.length === 0)}
              className="shrink-0 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium
                transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              送信
            </button>
          </form>
        </div>

        {/* 隠しファイル入力 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
