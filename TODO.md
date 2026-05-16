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

- [x] GitHub リポジトリを作成して push → https://github.com/akzy4/story-chat
- [x] Vercel にプロジェクトをインポート
- [x] Vercel ダッシュボードで環境変数 `ANTHROPIC_API_KEY` を設定
- [x] デプロイ完了後、本番 URL で動作確認 → Ready ✅

---

## 残課題・バグ修正

### 🔴 重大バグ

- [ ] **会話履歴の順序バグ** — `startStory` はアシスタントメッセージだけを state に追加するため、
  ユーザーが最初のメッセージを送ると history が `[assistant, user]` の順になり Anthropic API が 400 エラーを返す
  - 修正方針: `startStory` 内で `ADD_USER` も dispatch してトリガーメッセージ（"物語を始めてください。"）を
    state に含める。`MessageBubble` に `hidden` フラグを追加して UI 上は非表示にする
- [ ] **リセット中のストリーミング競合** — ストリーミング中に「ジャンル選択に戻る」を押すと
  `dispatch` がリセット後の state に作用し続けてメッセージが混入するリスクがある
  - 修正方針: `sendMessage` / `startStory` で `AbortController` を使い、
    `handleReset` 時に `abort()` を呼んでフェッチをキャンセルする

### 🟠 セキュリティ・堅牢性

- [ ] **route.ts のリクエストバリデーション不足** — `messages` が配列かどうか、
  `systemPrompt` が文字列かどうかの検証がなく、不正な入力でクラッシュしうる
  - 修正方針: `zod` または手動チェックで `messages`・`systemPrompt` を検証し、400 を返す
- [ ] **Vercel Function のタイムアウト未設定** — デフォルトは 10 秒。長い物語生成が途中で
  切れるリスクがある
  - 修正方針: `route.ts` に `export const maxDuration = 60;` を追加（Vercel Pro は最大 300 秒）
- [ ] **AbortController 未実装** — ネットワークエラーや遅延時にフェッチをキャンセルできない
  - 修正方針: `useRef<AbortController>` を持ち、送信時に新しい controller を生成、
    アンマウント時と `handleReset` 時に `abort()` を呼ぶ

### 🟡 コード品質

- [ ] **ストリーミングロジックの重複** — `startStory` と `sendMessage` がほぼ同じ
  fetch + ReadableStream 読み取りコードを持っている
  - 修正方針: `src/lib/stream.ts` に `streamChat(messages, systemPrompt, dispatch, setIsStreaming)`
    ヘルパーを切り出して両関数から呼ぶ

### 🟢 UX・アクセシビリティ・パフォーマンス

- [ ] **エラーバウンダリ未実装** — 予期しない React エラーが画面を真っ白にしても
  ユーザーにメッセージが表示されない
  - 修正方針: `src/components/ErrorBoundary.tsx` を作成し `layout.tsx` で wrap する
- [ ] **スクロールのパフォーマンス** — チャンクごとに `scrollIntoView` が呼ばれ、
  高頻度更新で画面がガタつく可能性がある
  - 修正方針: `ChatWindow` の `useEffect` を `useRef` + `requestAnimationFrame` でスロットリングするか、
    スクロールをユーザーが一番下にいるときだけ実行する（Intersection Observer）
- [ ] **ChatWindow のメモ化不足** — チャンクごとに `ChatWindow` 全体が再描画される
  - 修正方針: `MessageBubble` を `React.memo` でラップし、完了済みメッセージの再描画を抑制
- [ ] **スクリーンリーダー対応なし** — ストリーミング中のテキスト更新がスクリーンリーダーに通知されない
  - 修正方針: `ChatWindow` の末尾に `aria-live="polite"` な隠し要素を設け、
    最新のアシスタントメッセージをそこに反映する

---

## 将来機能（スコープ外）

- [ ] レート制限・abuse 対策（同一 IP からの過剰リクエスト制限）
- [ ] ストーリーのエクスポート機能（テキストコピー／PDF 出力）
- [ ] ユーザー認証＋会話履歴の永続化
- [ ] ジャンル追加（ロマンス、時代劇 など）
