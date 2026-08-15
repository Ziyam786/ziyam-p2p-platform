import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!config.ai.anthropicApiKey) return null;
  if (!client) client = new Anthropic({ apiKey: config.ai.anthropicApiKey });
  return client;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Calls Claude with the given system prompt and conversation history.
 * Returns a friendly fallback message instead of throwing if no API key is
 * configured yet — same "stub the unavailable external service" pattern as
 * paymentGateway.ts / telematicsService.ts.
 */
export async function generateChatReply(systemPrompt: string, history: ChatTurn[]): Promise<string> {
  const anthropic = getClient();
  if (!anthropic) {
    return (
      "I'm not fully set up yet — the site owner needs to add an ANTHROPIC_API_KEY " +
      'before I can answer questions. In the meantime, reach a human at support@ziyam.in.'
    );
  }

  try {
    const response = await anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 512,
      system: systemPrompt,
      messages: history.map((turn) => ({ role: turn.role, content: turn.content })),
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock && textBlock.type === 'text'
      ? textBlock.text
      : "Sorry, I couldn't generate a response. Please try again or contact support@ziyam.in.";
  } catch (error: any) {
    console.error('[AI SERVICE] Anthropic call failed:', error.message ?? error);
    return "I'm having trouble reaching the AI service right now. Please try again shortly, or contact support@ziyam.in.";
  }
}
