import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

export const runtime = 'edge';

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

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: truncatedMessages,
  });

  const readable = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      stream.on('text', (text) => {
        controller.enqueue(encoder.encode(text));
      });
      stream.on('finalMessage', () => {
        controller.close();
      });
      stream.on('error', (error) => {
        controller.error(error);
      });
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
