import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

// Anthropic SDK が node:fs / node:path を使うため Node.js ランタイムを使用
export const runtime = 'nodejs';

// 20ターン分（user + assistant で 40メッセージ）を上限とする
const MAX_MESSAGES = 40;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

type AllowedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

interface ImageAttachment {
  data: string; // base64
  mediaType: AllowedMediaType;
}

interface AppMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: ImageAttachment[];
}

function toMessageParam(msg: AppMessage): MessageParam {
  if (!msg.images || msg.images.length === 0) {
    return { role: msg.role, content: msg.content };
  }

  const content = [
    ...msg.images.map((img) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: img.mediaType,
        data: img.data,
      },
    })),
    ...(msg.content.trim() ? [{ type: 'text' as const, text: msg.content }] : []),
  ];

  return { role: msg.role, content } as MessageParam;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response('ANTHROPIC_API_KEY is not configured', { status: 500 });
  }

  const { messages, systemPrompt } = (await req.json()) as {
    messages: AppMessage[];
    systemPrompt: string;
  };

  // 画像バリデーション
  for (const msg of messages) {
    if (!msg.images) continue;
    for (const img of msg.images) {
      if (!ALLOWED_MEDIA_TYPES.has(img.mediaType)) {
        return new Response(
          `未対応の画像形式です: ${img.mediaType}`,
          { status: 400 }
        );
      }
      // base64 文字数 × 0.75 ≈ 実バイト数
      if (Math.ceil(img.data.length * 0.75) > MAX_IMAGE_BYTES) {
        return new Response('画像が 5MB を超えています', { status: 400 });
      }
    }
  }

  const anthropicMessages = messages.slice(-MAX_MESSAGES).map(toMessageParam);

  const client = new Anthropic({ apiKey });

  // ReadableStream の start 内でストリームを開始することで競合状態を回避
  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          system: systemPrompt,
          messages: anthropicMessages,
        });

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Vercel / nginx のバッファリングを無効化してリアルタイム配信を保証
      'X-Accel-Buffering': 'no',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
