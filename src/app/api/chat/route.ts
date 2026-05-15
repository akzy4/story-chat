import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

// Anthropic SDK が node:fs / node:path を使うため Node.js ランタイムを使用
export const runtime = 'nodejs';

// 20ターン分（user + assistant で 40メッセージ）を上限とする
const MAX_MESSAGES = 40;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response('ANTHROPIC_API_KEY is not configured', { status: 500 });
  }

  const { messages, systemPrompt } = (await req.json()) as {
    messages: MessageParam[];
    systemPrompt: string;
  };

  const truncatedMessages = messages.slice(-MAX_MESSAGES);

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
          messages: truncatedMessages,
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
