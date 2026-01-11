import Anthropic from '@anthropic-ai/sdk';

// Initialize the Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export default anthropic;

// Export helper for creating messages with proper error handling
export async function createMessage(params: Anthropic.MessageCreateParamsNonStreaming) {
  try {
    const message = await anthropic.messages.create(params);
    return message;
  } catch (error) {
    console.error('Anthropic API Error:', error);
    throw error;
  }
}
