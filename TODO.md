# 実行計画 TODO

ストーリーテリング AI チャットボットの構築タスク一覧。
上から順に実施する。各フェーズが完了してから次へ進むこと。

---

## Phase 1: プロジェクト初期化

- [x] `npx create-next-app@latest` で Next.js プロジェクト作成
  - TypeScript: Yes / ESLint: Yes / Tailwind CSS: Yes / App Router: Yes / src/ directory: Yes
- [x] 不要なボイラープレートを削除（`app/page.tsx` の中身、`globals.css` のサンプルスタイル）
- [x] 依存パッケージを追加インストール
  - `@anthropic-ai/sdk` — Anthropic SDK
  - `next-themes` — ライト／ダークモード管理
- [x] `.env.local` を作成し `ANTHROPIC_API_KEY` を設定
- [x] `.gitignore` に `.env.local` が含まれていることを確認

---

## Phase 2: API Route（バックエンド）

- [x] `src/app/api/chat/route.ts` を作成
  - `export const runtime = 'edge'` を設定
  - リクエストボディから `messages`（会話履歴）と `systemPrompt` を受け取る
  - Anthropic SDK の `stream()` で Claude に投げる（モデル: `claude-sonnet-4-5`、`max_tokens: 1024`）
  - `ReadableStream` をそのままレスポンスとして返す
- [x] 会話が長い場合に古いメッセージを truncate する処理を追加（最大 20 ターン程度）
- [x] API キーが未設定の場合は 500 エラーを返す最低限のガード追加

---

## Phase 3: System Prompt テンプレート

- [x] `src/lib/prompts.ts` を作成
  - ジャンルの型定義（`'fantasy' | 'sci-fi' | 'horror' | 'mystery'`）
  - ジャンルごとの System Prompt テンプレートを定義
  - `buildSystemPrompt(genre, setting)` 関数をエクスポート
- [x] 各ジャンルのプロンプトに以下を含める
  - 語り手としての役割定義
  - そのジャンル固有の文体・雰囲気の指示
  - ユーザーの入力をストーリーに組み込む方法の指示

---

## Phase 4: UI コンポーネント

- [x] `src/app/layout.tsx` にテーマプロバイダー（`next-themes` の `ThemeProvider`）を設置
- [x] `src/components/ThemeToggle.tsx` — ライト／ダーク切替ボタン
- [x] `src/components/GenreSelector.tsx` — ジャンル・世界観設定選択 UI
  - ジャンルカード（4種）を選択
  - 世界観の補足テキストを自由入力できるフィールド
  - 「ストーリーを始める」ボタン
- [x] `src/components/MessageBubble.tsx` — メッセージ 1 件のバブル表示
  - AI: 左寄せ、ダーク時は半透明の深色背景
  - User: 右寄せ、アクセントカラー
  - ストリーミング中はカーソル点滅を表示
- [x] `src/components/ChatWindow.tsx` — メッセージ一覧
  - `messages` 配列を受け取り `MessageBubble` を並べる
  - 新しいメッセージが来たら自動スクロール（`useEffect` + `ref`）

---

## Phase 5: メインページ（状態管理・ストリーミング受信）

- [x] `src/app/page.tsx` を実装
  - `useState` でフェーズ管理（`'select'` → `'chat'`）
  - `messages` 配列を `useReducer` で管理
  - `GenreSelector` で設定を受け取ったら `systemPrompt` を組み立て、フェーズを `'chat'` へ
  - テキスト入力フォームと送信ボタン
- [x] ストリーミング受信処理を実装
  - `fetch('/api/chat', { method: 'POST', body: ... })`
  - `response.body.getReader()` でチャンク読み込み
  - 読み込み中は最後の AI メッセージを逐次更新
  - 送信中はフォームを `disabled` にする

---

## Phase 6: スタイリング

- [x] `tailwind.config.ts` でダークモードを `class` ベースに設定（Tailwind v4 のため `globals.css` に `@custom-variant dark` で設定）
- [x] `globals.css` にダーク時の背景色・テキスト色のカスタム CSS 変数を定義
  - ダーク: 深い紺〜黒系（`#0d1117` など）で沈浸感を演出
  - ライト: 白〜薄グレー系
- [x] 各コンポーネントにダーク対応の Tailwind クラスを付与（`dark:` プレフィックス）
- [x] モバイル対応レイアウト確認（チャット画面が小画面でも崩れないこと）

---

## Phase 7: 動作確認・品質チェック

- [x] `npm run dev` でローカル動作確認
  - ジャンル選択 → ストーリー開始 → ターン制会話が機能すること
  - ストリーミングで文字がリアルタイムに流れること
  - ライト／ダーク切替が正しく動くこと
- [x] `npm run build` でビルドエラーがないことを確認
- [x] `npm run lint` でリントエラーがないことを確認（ThemeToggle の useEffect→useSyncExternalStore 修正済み）
- [x] `npm run type-check` で型エラーがないことを確認
- [x] API キーをブラウザの DevTools から確認できないことを確認（route.ts のサーバーサイドのみ参照）

---

## Phase 8: Vercel デプロイ

- [ ] GitHub リポジトリを作成して push
- [ ] Vercel にプロジェクトをインポート
- [ ] Vercel ダッシュボードで環境変数 `ANTHROPIC_API_KEY` を設定
- [ ] デプロイ完了後、本番 URL で動作確認

---

## 残課題・将来対応（今回のスコープ外）

- [ ] レート制限・abuse 対策（同一 IP からの過剰リクエスト制限）
- [ ] ストーリーのエクスポート機能（テキストコピー／PDF 出力）
- [ ] ユーザー認証＋会話履歴の永続化
- [ ] ジャンル追加（ロマンス、時代劇 など）
