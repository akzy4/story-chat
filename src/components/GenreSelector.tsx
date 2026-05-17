"use client";

import { useState } from "react";
import { Genre, GENRE_LABELS, GENRE_DESCRIPTIONS } from "@/lib/prompts";

interface Props {
  onStart: (genre: Genre, setting: string) => void;
}

const GENRE_ICONS: Record<Genre, string> = {
  fantasy: "⚔️",
  "sci-fi": "🚀",
  horror: "👻",
  mystery: "🔍",
};

export default function GenreSelector({ onStart }: Props) {
  const [selected, setSelected] = useState<Genre | null>(null);
  const [setting, setSetting] = useState("");

  const genres: Genre[] = ["fantasy", "sci-fi", "horror", "mystery"];

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto px-4 py-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Story Chat — AIと紡ぐ物語！！</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          ジャンルを選んで、AIと物語を紡ごう
        </p>
      </div>

      {/* ジャンルカード: モバイルは1列、sm以上は2列 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        {genres.map((genre) => (
          <button
            key={genre}
            onClick={() => setSelected(genre)}
            className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all
              ${
                selected === genre
                  ? "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/20 ring-1 ring-indigo-500/30"
                  : "border-black/10 dark:border-white/10 hover:border-indigo-400/50 dark:hover:border-indigo-400/40"
              }`}
            style={{ background: selected !== genre ? "var(--card-bg)" : undefined }}
          >
            <span className="text-2xl">{GENRE_ICONS[genre]}</span>
            <span className="font-semibold text-sm">{GENRE_LABELS[genre]}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {GENRE_DESCRIPTIONS[genre]}
            </span>
          </button>
        ))}
      </div>

      {/* 世界観テキストエリア */}
      <div className="w-full">
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
          世界観・補足設定（任意）
        </label>
        <textarea
          value={setting}
          onChange={(e) => setSetting(e.target.value)}
          placeholder="例：主人公は魔法学校の落ちこぼれ学生。舞台は霧深い古都。"
          rows={3}
          className="w-full rounded-lg border border-black/10 dark:border-white/10
            bg-black/5 dark:bg-white/5 px-3 py-2 text-sm resize-none
            focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:opacity-30"
        />
      </div>

      <button
        disabled={!selected}
        onClick={() => selected && onStart(selected, setting)}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all
          bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white
          disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ストーリーを始める
      </button>
    </div>
  );
}
