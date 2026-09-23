/**
 * The TypeSafe client.
 *
 * fetch-only and dependency-free, so the same build runs in node, bun, deno,
 * workers and the playground's browser bundle.
 */
import type {
  ModelMetadata,
  Questions,
  SystemOneRequest,
  SystemOneResponse,
  Content,
} from '../types/index';
import { TypeSafeResponseError, validateQuestions, validateResponse } from '../validators/index';

export const DEFAULT_BASE_URL = 'https://api.typesafe.ai';
export const DEFAULT_MODEL = 'jev-latest';

export interface TypeSafeClientConfig {
  /**
   * API key. Falls back to `TYPESAFE_API_KEY` from the environment when a
   * process-like global is available, which it is not in a browser.
   */
  apiKey?: string;
  /** Base URL of the API. Defaults to {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
  /** Model name or alias used when a request does not name one. */
  model?: string;
  /** Request timeout in milliseconds. Default 30000. */
  timeoutMs?: number;
  /**
   * Retries for transient failures (429, 5xx, network errors). Default 2, so
   * three attempts in total. Set 0 to disable. Non-transient responses such as
   * 401, 403 and 422 are never retried.
   */
  maxRetries?: number;
  /** Swap in a different fetch, mainly for tests. Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
  /**
   * Check responses against the questions that produced them. On by default,
   * because without it the inferred types are only a promise. Turning it off
   * saves a negligible amount of work and gives up the guarantee.
   */
  validate?: boolean;
}

/** A non-2xx response from the API. */
export class TypeSafeApiError extends Error {
  public readonly status: number;
  public readonly body: unknown;
  /** The API's own error classification, e.g. `authentication_error`. */
  public readonly errorType: string | undefined;

  constructor(message: string, status: number, body: unknown, errorType?: string) {
    super(message);
    this.name = 'TypeSafeApiError';
    this.status = status;
    this.body = body;
    this.errorType = errorType;
  }
}

/** A request that never got an answer: timeout, DNS, connection reset. */
export class TypeSafeConnectionError extends Error {
  public readonly cause: unknown;
  constructor(message: string, cause: unknown) {
    super(message);
    this.name = 'TypeSafeConnectionError';
    this.cause = cause;
  }
}

/** Thrown for a questions map the API would reject, before spending a request. */
export class TypeSafeRequestError extends Error {
  public readonly problems: string[];
  constructor(problems: string[]) {
    super(`Invalid request:\n  - ${problems.join('\n  - ')}`);
    this.name = 'TypeSafeRequestError';
    this.problems = problems;
  }
}

function readEnvKey(): string | undefined {
  // Guarded so the bundle does not assume node. `process` is absent in a
  // browser and Deno without --allow-env, and neither should throw here.
  try {
    const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    return p?.env?.['TYPESAFE_API_KEY'];
  } catch {
    return undefined;
  }
}

/** Errors worth trying again. A 429 or a 5xx may well succeed on a retry; a 403 will not. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TypeSafeClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly validate: boolean;

  constructor(config: TypeSafeClientConfig = {}) {
    const apiKey = config.apiKey ?? readEnvKey();
    if (!apiKey) {
      throw new Error(
        'No TypeSafe API key. Pass { apiKey } or set TYPESAFE_API_KEY in the environment.',
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.model = config.model ?? DEFAULT_MODEL;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.maxRetries = config.maxRetries ?? 2;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    this.validate = config.validate ?? true;

    if (typeof this.fetchImpl !== 'function') {
      throw new Error('No fetch available. Pass { fetch } or run on a runtime that provides it.');
    }
  }

  /**
   * Evaluate a set of named questions against one piece of content.
   *
   * Every question in the call is evaluated against the same state in one
   * round trip. The returned `answers` is keyed by the names you chose and
   * typed by the questions you wrote.
   *
   * ```ts
   * const res = await client.systemOne({
   *   state: ticket,
   *   questions: {
   *     isUrgent: noul({ instructions: 'Does this convey time-sensitivity?' }),
   *     category: choice({ criteria: { billing: 'Money', bug: 'Broken' } }),
   *   },
   * });
   * res.answers.isUrgent.noul    // number
   * res.answers.category.choice  // 'billing' | 'bug'
   * ```
   */
  async systemOne<const Q extends Questions>(
    request: SystemOneRequest<Q>,
  ): Promise<SystemOneResponse<Q>> {
    const problems = validateQuestions(request.questions);
    if (problems.length) throw new TypeSafeRequestError(problems);

    const body = await this.post('/v1/systemone', {
      state: request.state,
      model: request.model ?? this.model,
      questions: request.questions,
    });

    if (!this.validate) return body as SystemOneResponse<Q>;
    return validateResponse(body, request.questions);
  }

  /**
   * Ask a single question and get just its answer back, for the common case
   * where wrapping one question in a map is noise.
   *
   * ```ts
   * const urgent = await client.ask(ticket, noul({ instructions: 'Urgent?' }));
   * urgent.noul // number
   * ```
   */
  async ask<const Q extends Questions[string]>(
    state: Content,
    question: Q,
    options?: { model?: string },
  ): Promise<SystemOneResponse<{ answer: Q }>['answers']['answer']> {
    const res = await this.systemOne({
      state,
      questions: { answer: question },
      ...(options?.model ? { model: options.model } : {}),
    });
    return res.answers.answer;
  }

  /** The models this account may use. */
  async models(): Promise<ModelMetadata[]> {
    const body = await this.get('/v1/models');
    // The spec wraps the list; tolerate a bare array too rather than breaking
    // on a shape the server is entitled to tighten.
    if (Array.isArray(body)) return body as ModelMetadata[];
    if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)) {
      return (body as { data: ModelMetadata[] }).data;
    }
    if (body && typeof body === 'object' && Array.isArray((body as { models?: unknown }).models)) {
      return (body as { models: ModelMetadata[] }).models;
    }
    throw new TypeSafeResponseError(['GET /v1/models did not return a list of models'], body);
  }

  // -------------------------------------------------------------------------
  // Transport
  // -------------------------------------------------------------------------

  private get(path: string): Promise<unknown> {
    return this.request('GET', path);
  }

  private post(path: string, payload: unknown): Promise<unknown> {
    return this.request('POST', path, payload);
  }

  private async request(method: string, path: string, payload?: unknown): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff, capped. Deliberately not jittered: without a
        // shared client pool there is nothing to thunder.
        await sleep(Math.min(250 * 2 ** (attempt - 1), 4_000));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
          signal: controller.signal,
        });

        if (response.ok) return await response.json();

        const errorBody = await this.readBody(response);
        if (isRetryableStatus(response.status) && attempt < this.maxRetries) {
          lastError = errorBody;
          continue;
        }
        throw this.toApiError(response.status, errorBody);
      } catch (err) {
        if (err instanceof TypeSafeApiError) throw err;
        // A network-level failure. Retry if there are attempts left.
        lastError = err;
        if (attempt < this.maxRetries) continue;
        const aborted = err instanceof Error && err.name === 'AbortError';
        throw new TypeSafeConnectionError(
          aborted
            ? `TypeSafe request timed out after ${this.timeoutMs}ms`
            : `TypeSafe request failed: ${err instanceof Error ? err.message : String(err)}`,
          err,
        );
      } finally {
        clearTimeout(timer);
      }
    }

    throw new TypeSafeConnectionError('TypeSafe request failed after retries', lastError);
  }

  private async readBody(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      try {
        return await response.text();
      } catch {
        return undefined;
      }
    }
  }

  /**
   * Turn an error body into a typed error. The API nests its errors under
   * `detail`, either as `{error_type, message}` or, for a 422, as the list of
   * validation errors FastAPI produces.
   */
  private toApiError(status: number, body: unknown): TypeSafeApiError {
    const detail = (body as { detail?: unknown } | undefined)?.detail;

    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      const d = detail as { error_type?: string; message?: string };
      return new TypeSafeApiError(
        d.message ?? `TypeSafe request failed with status ${status}`,
        status,
        body,
        d.error_type,
      );
    }

    if (Array.isArray(detail)) {
      const summary = detail
        .map((e: { loc?: unknown[]; msg?: string }) =>
          `${(e.loc ?? []).join('.')}: ${e.msg ?? 'invalid'}`,
        )
        .join('; ');
      return new TypeSafeApiError(
        `TypeSafe rejected the request: ${summary}`,
        status,
        body,
        'validation_error',
      );
    }

    return new TypeSafeApiError(`TypeSafe request failed with status ${status}`, status, body);
  }
}
