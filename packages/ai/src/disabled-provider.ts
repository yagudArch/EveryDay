/**
 * DisabledProvider — the honest default of @everyday/ai.
 *
 * Foundation ships no AI credentials, so the default provider is disabled: it advertises
 * `configured: false` and throws a typed AIServiceError (code AI_UNAVAILABLE, HTTP 503) for
 * every operation instead of returning canned, echoed or empty "successful" data.
 *
 * This is production code, not a test double: it is the only provider compiled into dist/.
 * Test fakes live exclusively in *.test.ts files.
 */

import { AIServiceError } from './errors.js';
import type {
  AIProvider,
  AIProviderStatus,
  EmbeddingsRequest,
  EmbeddingsResult,
  SpeechToTextRequest,
  StructuredRequest,
  StructuredResult,
  TextRequest,
  TextResult,
  ToolCallRequest,
  ToolCallResult,
  TranscriptResult,
  VisionRequest,
} from './provider.js';

export const DISABLED_PROVIDER_NAME = 'disabled';

function unavailable(operation: string): AIServiceError {
  return new AIServiceError(
    'AI_UNAVAILABLE',
    `AI provider is not configured; "${operation}" is unavailable`,
    503,
    { details: { operation } },
  );
}

export class DisabledProvider implements AIProvider {
  readonly name = DISABLED_PROVIDER_NAME;

  status(): AIProviderStatus {
    return { provider: this.name, configured: false, capabilities: [] };
  }

  async text(_request: TextRequest): Promise<TextResult> {
    throw unavailable('text');
  }

  async vision(_request: VisionRequest): Promise<TextResult> {
    throw unavailable('vision');
  }

  async speechToText(_request: SpeechToTextRequest): Promise<TranscriptResult> {
    throw unavailable('speech_to_text');
  }

  async structured(_request: StructuredRequest): Promise<StructuredResult> {
    throw unavailable('structured_output');
  }

  async embeddings(_request: EmbeddingsRequest): Promise<EmbeddingsResult> {
    throw unavailable('embeddings');
  }

  async tools(_request: ToolCallRequest): Promise<ToolCallResult> {
    throw unavailable('tools');
  }
}
