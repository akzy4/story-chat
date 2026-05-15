# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

ユーザーと Claude AI が共同でインタラクティブなストーリーを作り上げる、エンターテイメント向け Web チャットボット。

## 技術スタック

| 項目 | 選択 |
|------|------|
| フレームワーク | Next.js (App Router) |
| AI モデル | Claude (Anthropic) — `claude-sonnet-4-5` 推奨 |
| デプロイ | Vercel |
| スタイリング | Tailwind CSS（ライト／ダークモード切替対応） |

## 主要機能仕様

### ストーリーテリング機能
- セッション開始時にユーザーがジャンル（ファンタジー / SF / ホラー / ミステリー など）と世界観設定を選択する
- 選択した設定を System Prompt に組み込み、Claude がその世界観に沿って物語を進行する
- ユーザーのメッセージに対して Claude が次の展開を提示し、ターン制で物語を共同制作する

### 会話履歴
- セッション内のみ保持（ブラウザ閉じると消える）
- `useState` または `useReducer` でクライアント側管理、サーバー側への永続化は行わない

### ストリーミング応答
- Anthropic SDK の `stream()` を使い、文字が順次流れるように表示する
- Next.js Route Handler から `ReadableStream` を返し、フロント側で `EventSource` または `fetch` + `ReadableStream` で受信する

### API キー管理
- Anthropic API キーはサーバーサイドのみで扱う（Route Handler 内）
- 環境変数 `ANTHROPIC_API_KEY` に設定し、クライアントには絶対に露出させない

### UI / UX
- ライト／ダークモード切替（`next-themes` 等を使用）
- ダーク時は深色ベースで物語の沈浸感を演出
- チャット UI はバブル形式、AI の発言は左、ユーザーの発言は右

## ディレクトリ構成（想定）

```
src/
  app/
    api/
      chat/
        route.ts        # Anthropic API へのリレー（ストリーミング）
    page.tsx            # チャット UI
    layout.tsx          # テーマプロバイダー設置
  components/
    ChatWindow.tsx      # メッセージ一覧
    MessageBubble.tsx   # 個々のメッセージ
    GenreSelector.tsx   # ジャンル・設定選択 UI
    ThemeToggle.tsx     # ライト／ダーク切替ボタン
  lib/
    prompts.ts          # ジャンル別 System Prompt テンプレート
```

## 開発コマンド

```bash
npm install          # 依存インストール
npm run dev          # 開発サーバー起動 (http://localhost:3000)
npm run build        # プロダクションビルド
npm run lint         # ESLint 実行
npm run type-check   # tsc --noEmit
```

## 環境変数

`.env.local` に以下を設定（Vercel ダッシュボードでも同様に設定）:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## 実装上の注意点

- Route Handler は `export const runtime = 'edge'` にするとストリーミングのレイテンシが下がる（Vercel Edge Runtime）
- System Prompt にはジャンル設定を含め、「あなたは物語の語り手です。ユーザーと共にストーリーを作ります。」という役割定義を必ず含める
- トークン上限に備え、会話が長くなったらメッセージ履歴を適切に truncate する（最古のメッセージから削除）
- `max_tokens` は 1024 程度を初期値とし、長い描写が必要な場面では 2048 まで許容する
