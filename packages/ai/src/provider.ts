/**
 * Provider extension port for @everyday/ai (FND-004).
 *
 * This file is the ONLY place where an external AI backend is described. It is a port,
 * not an adapter: Foundation ships no live vendor integration (no credentials, no keys,
 * no vendor model identifiers) — see .ai/TASKS.md AI-001.
 *
 * Hard rules baked into the contract:
 *  - No vendor or model names appear anywhere in this package; an adapter reports its own
 *    adapter identifier via `name`/`status().provider` (for example 'disabled' or an
 *    adapter-owned slug). Vendor selection stays outside the Foundation scope.
 *  - Binary payloads (images, audio) cross the boundary as explicit mime + bytes pairs;
 *    the port never receives file paths, streams, buffers of unknown type, or DB handles.
 *  - A provider MUST throw `AIServiceError` for expected failure modes and MUST NOT fake
 *    success: no canned/echoed answers, no empty-but-valid results when it cannot serve.
 *  - A provider never applies changes and never executes tool calls; it only returns data.
 *  - Credentials are owned by the adapter's own configuration and never passed by AIService.
 */

import type { AICapability } from '@everyday/contracts';

/** Capabilities reserved by the port; mirrors AICapabilitySchema of @everyday/contracts. */
export const AI_CAPABILITIES: readonly AICapability[] = [
  'text',
  'vision',
  'speech_to_text',
  'structured_output',
  'embeddings',
  'tools',
];

/** Explicit binary boundary: raw bytes + declared mime type. No paths, no streams. */
export interface BinaryInput<TMimeType extends string = string> {
  readonly mimeType: TMimeType;
  readonly bytes: Uint8Array;
}

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

export const AUDIO_MIME_TYPES = [
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
] as const;
export type AudioMimeType = (typeof AUDIO_MIME_TYPES)[number];

export interface ImageInput extends BinaryInput<ImageMimeType> {
  readonly width?: number;
  readonly height?: number;
}

export interface AudioInput extends BinaryInput<AudioMimeType> {
  /** Duration is advisory metadata for STT providers that need it. */
  readonly durationMs?: number;
  /** BCP-47 language hint (e.g. 'ru'), never the user's profile data. */
  readonly language?: string;
}

/** Shared call controls: every provider call is cancellable and time-bounded. */
export interface ProviderCallOptions {
  /** Aborts the provider request. AIService always passes one. */
  readonly signal?: AbortSignal;
  /** Advisory budget in milliseconds; AIService enforces its own hard timeout too. */
  readonly timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// text
// ---------------------------------------------------------------------------

export interface TextRequest extends ProviderCallOptions {
  readonly prompt: string;
  readonly systemInstruction?: string;
  readonly maxOutputTokens?: number;
}

export interface TextResult {
  readonly text: string;
  readonly finishReason: 'stop' | 'length' | 'aborted' | 'unknown';
}

// ---------------------------------------------------------------------------
// vision
// ---------------------------------------------------------------------------

export interface VisionRequest extends ProviderCallOptions {
  readonly prompt: string;
  readonly images: readonly ImageInput[];
  readonly maxOutputTokens?: number;
}

// ---------------------------------------------------------------------------
// speech-to-text
// ---------------------------------------------------------------------------

export interface SpeechToTextRequest extends ProviderCallOptions {
  readonly audio: AudioInput;
}

export interface TranscriptResult {
  readonly text: string;
  readonly language?: string;
  readonly confidence?: number;
}

// ---------------------------------------------------------------------------
// structured output (the only path used by intent parsing)
// ---------------------------------------------------------------------------

export interface StructuredRequest extends ProviderCallOptions {
  /** Logical schema name (not a vendor-specific response format name). */
  readonly schemaName: string;
  /** Instruction describing the required JSON shape. */
  readonly instruction: string;
  /** Minimized input payload. Never contains credentials or the full user context. */
  readonly input: unknown;
  readonly maxOutputTokens?: number;
}

/**
 * Raw provider output. Intentionally `unknown`: AIService always re-validates it against the
 * strict contract schema and never trusts the provider's own claims about validity.
 */
export interface StructuredResult {
  readonly output: unknown;
}

// ---------------------------------------------------------------------------
// embeddings
// ---------------------------------------------------------------------------

export interface EmbeddingsRequest extends ProviderCallOptions {
  readonly inputs: readonly string[];
}

export interface EmbeddingsResult {
  readonly vectors: readonly (readonly number[])[];
  readonly dimensions: number;
}

// ---------------------------------------------------------------------------
// tools (declaration only — execution belongs to BACKEND, never to this package)
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  /** JSON schema of the arguments; validated by the tool owner, not by AIService. */
  readonly parameters: unknown;
}

export interface ToolCallRequest extends ProviderCallOptions {
  readonly prompt: string;
  readonly tools: readonly ToolDefinition[];
}

export interface ToolCall {
  readonly name: string;
  readonly arguments: unknown;
}

export interface ToolCallResult {
  readonly calls: readonly ToolCall[];
}

// ---------------------------------------------------------------------------
// provider status + interface
// ---------------------------------------------------------------------------

/** Provider self-description; AIService re-validates it against AIStatusSchema. */
export interface AIProviderStatus {
  /** Adapter identifier, never a vendor model identifier. */
  readonly provider: string;
  readonly configured: boolean;
  readonly capabilities: readonly AICapability[];
}

/**
 * The provider port. Implementations live outside this package (adapter owned by AI-001).
 * Any implementation must satisfy the hard rules documented at the top of this file.
 */
export interface AIProvider {
  /** Adapter identifier, mirrored in status().provider. */
  readonly name: string;
  status(): AIProviderStatus;
  text(request: TextRequest): Promise<TextResult>;
  vision(request: VisionRequest): Promise<TextResult>;
  speechToText(request: SpeechToTextRequest): Promise<TranscriptResult>;
  structured(request: StructuredRequest): Promise<StructuredResult>;
  embeddings(request: EmbeddingsRequest): Promise<EmbeddingsResult>;
  tools(request: ToolCallRequest): Promise<ToolCallResult>;
}
