/**
 * @everyday/ai — public surface (FND-004).
 *
 * Scope: AI abstraction only. No vendor adapter, no vendor model identifiers, no
 * credentials, no database access, no persistence and no automatic application of parsed
 * actions. A live provider adapter is a separate protected task (AI-001) and must implement
 * the AIProvider port from './provider.js'.
 */

export { AIServiceError, isAIServiceError, unavailableError } from './errors.js';
export type { AIServiceErrorCode, AIServiceErrorOptions } from './errors.js';

export { AI_CAPABILITIES } from './provider.js';
export type {
  AIProvider,
  AIProviderStatus,
  AudioInput,
  AudioMimeType,
  BinaryInput,
  EmbeddingsRequest,
  EmbeddingsResult,
  ImageInput,
  ImageMimeType,
  ProviderCallOptions,
  SpeechToTextRequest,
  StructuredRequest,
  StructuredResult,
  TextRequest,
  TextResult,
  ToolCall,
  ToolCallRequest,
  ToolCallResult,
  ToolDefinition,
  TranscriptResult,
  VisionRequest,
} from './provider.js';

export { DisabledProvider, DISABLED_PROVIDER_NAME } from './disabled-provider.js';

export {
  AI_SERVICE_LIMITS,
  AIService,
} from './service.js';
export type { AIServiceOptions, ParseCallOptions } from './service.js';

export {
  DATE_PATTERN,
  PARSER_INSTRUCTION,
  PROMPT_CONTEXT_FIELDS,
  buildPromptContext,
  minimizeContext,
} from './context.js';
export type { PromptContext, PromptContextInput } from './context.js';
