// B2: Claude API 클라이언트
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';
export const MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS ?? '2048', 10);
