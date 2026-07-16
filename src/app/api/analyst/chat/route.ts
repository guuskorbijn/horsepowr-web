import { NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/session';
import {
  getAnthropicClient,
  ANALYST_MODEL,
  ANALYST_TEMPERATURE,
  ANALYST_MAX_TOKENS,
  ANALYST_MAX_STEPS,
} from '@/lib/anthropic';
import { ANALYST_SYSTEM_PROMPT } from '@/services/analyst/systemPrompt';
import { ANALYST_TOOLS, dispatchAnalystTool } from '@/services/analyst/tools';

/**
 * Minimal Sonnet tool-calling endpoint for the web analyst chat.
 *
 * Security posture: the request runs server-side with the SSR Supabase client
 * (anon key + the user's auth cookies), so every tool read is governed by RLS.
 * The org id comes from the signed-in user's profile — the model cannot widen
 * scope. The Anthropic model never gets a DB connection; it only ever sees the
 * structured tool results the dispatcher returns. The Anthropic key is a
 * server-only secret (see lib/anthropic.ts).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessageInput[];
}

function parseBody(body: unknown): ChatRequestBody {
  if (typeof body !== 'object' || body === null || !('messages' in body)) {
    throw new Error('Body must be { messages: [{ role, content }] }.');
  }
  const raw = (body as { messages: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('"messages" must be a non-empty array.');
  }
  const messages: ChatMessageInput[] = raw.map((m, i) => {
    if (typeof m !== 'object' || m === null) throw new Error(`messages[${i}] must be an object.`);
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') {
      throw new Error(`messages[${i}].role must be "user" or "assistant".`);
    }
    if (typeof content !== 'string' || content.trim() === '') {
      throw new Error(`messages[${i}].content must be a non-empty string.`);
    }
    return { role, content };
  });
  if (messages[0]?.role !== 'user') {
    throw new Error('The first message must have role "user".');
  }
  return { messages };
}

/** Concatenate the text blocks of an assistant message into a reply string. */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

export async function POST(request: Request): Promise<Response> {
  // 1. Parse + validate the request body.
  let parsed: ChatRequestBody;
  try {
    parsed = parseBody(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request body.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 2. Authenticate + resolve org scope from the signed-in user.
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  if (!ctx.org) {
    return NextResponse.json(
      { error: 'Your profile is not assigned to a stable yet.' },
      { status: 403 },
    );
  }

  // 3. RLS-scoped client for tool reads; the tools also re-check org ownership.
  const supa = await getServerSupabase();
  const toolContext = { supa, orgId: ctx.org.id };

  // 4. Anthropic client (server-only key).
  let client: Anthropic;
  try {
    client = getAnthropicClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analyst chat is not configured.';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 5. Tool-calling loop. Bounded by ANALYST_MAX_STEPS.
  const messages: Anthropic.MessageParam[] = parsed.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const toolTrace: Array<{ tool: string; isError: boolean }> = [];

  try {
    for (let step = 0; step < ANALYST_MAX_STEPS; step++) {
      const response = await client.messages.create({
        model: ANALYST_MODEL,
        max_tokens: ANALYST_MAX_TOKENS,
        ...(ANALYST_TEMPERATURE !== undefined ? { temperature: ANALYST_TEMPERATURE } : {}),
        system: ANALYST_SYSTEM_PROMPT,
        tools: ANALYST_TOOLS,
        messages,
      });

      if (response.stop_reason !== 'tool_use') {
        return NextResponse.json({ reply: textOf(response), toolTrace });
      }

      // Record the assistant turn (must include the tool_use blocks) and answer
      // every tool call in a single following user message.
      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const result = await dispatchAnalystTool(block.name, block.input, toolContext);
        toolTrace.push({ tool: block.name, isError: result.isError });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result.content),
          is_error: result.isError,
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    // Exhausted the step budget without a final answer.
    return NextResponse.json(
      {
        error: `The analyst reached its ${ANALYST_MAX_STEPS}-step tool budget without finishing. Try a narrower question.`,
        toolTrace,
      },
      { status: 504 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The analyst failed to respond.';
    return NextResponse.json({ error: message, toolTrace }, { status: 502 });
  }
}
