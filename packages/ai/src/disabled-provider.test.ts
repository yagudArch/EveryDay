import { describe, expect, it } from 'vitest';
import { AIServiceError, DisabledProvider, DISABLED_PROVIDER_NAME } from './index.js';

const provider = new DisabledProvider();

async function captureError(run: () => Promise<unknown>): Promise<AIServiceError> {
  try {
    await run();
  } catch (error) {
    if (error instanceof AIServiceError) return error;
    throw error;
  }
  throw new Error('expected the promise to reject, but it resolved');
}

describe('DisabledProvider', () => {
  it('advertises an unconfigured status without capabilities', () => {
    expect(provider.name).toBe(DISABLED_PROVIDER_NAME);
    expect(provider.status()).toEqual({ provider: DISABLED_PROVIDER_NAME, configured: false, capabilities: [] });
  });

  it.each([
    ['text', 'text', () => provider.text({ prompt: 'hi' })],
    ['vision', 'vision', () => provider.vision({ prompt: 'hi', images: [] })],
    [
      'speech_to_text',
      'speech_to_text',
      () => provider.speechToText({ audio: { mimeType: 'audio/wav', bytes: new Uint8Array([1, 2, 3]) } }),
    ],
    [
      'structured_output',
      'structured_output',
      () => provider.structured({ schemaName: 'ActionPreview', instruction: 'x', input: {} }),
    ],
    ['embeddings', 'embeddings', () => provider.embeddings({ inputs: ['a'] })],
    ['tools', 'tools', () => provider.tools({ prompt: 'hi', tools: [] })],
  ])('rejects %s with a typed 503 AI_UNAVAILABLE and never fakes success', async (_label, operation, run) => {
    const error = await captureError(run);
    expect(error).toBeInstanceOf(AIServiceError);
    expect(error.code).toBe('AI_UNAVAILABLE');
    expect(error.statusCode).toBe(503);
    expect(error.details).toEqual({ operation });
    expect(error.message).toContain(operation);
  });

  it('exposes a serializable error projection for logging', async () => {
    const error = await captureError(() => provider.structured({ schemaName: 'ActionPreview', instruction: 'x', input: {} }));
    expect(error.toJSON()).toEqual({
      code: 'AI_UNAVAILABLE',
      message: error.message,
      statusCode: 503,
    });
  });
});
