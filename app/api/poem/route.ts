import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  const { feelings } = await request.json();

  const stream = client.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: `You are a gifted, contemplative poet with a deep sensitivity to human emotion.
When given a feeling or set of feelings, you craft a short, evocative poem — typically 8–16 lines.

Your poems are:
- Lyrical and imagistic, favoring concrete sensory details over abstract declarations
- Free verse or lightly structured — never forced rhyme
- Intimate in tone, as if written in a private journal
- Complete and self-contained

Return only the poem itself, with no title, no preamble, no explanation, no quotation marks.`,
    messages: [
      {
        role: "user",
        content: `Write a poem inspired by these feelings: ${feelings}`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
