"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

// SSR と CSR でのテーマ不一致を避けるため useSyncExternalStore で mounted を判定
function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useIsMounted();

  if (!mounted) return <div className="w-9 h-9" />;

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="テーマ切替"
      className="w-9 h-9 flex items-center justify-center rounded-lg text-lg
        hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
