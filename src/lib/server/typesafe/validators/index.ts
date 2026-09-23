/**
 * Runtime validation.
 *
 * The types are a compile-time promise. This module is the part that checks
 * the promise was kept, so the inference is not decoration. Everything here is
 * derived from the same questions object the caller already wrote: we know
 * which keys were asked for, which choices were offered and how many rubric
 * levels there were, so we can say precisely what came back wrong.
 */
import type { Answer, Questions, SystemOneResponse, Usage } from '../types/index';

/** Thrown when a response does not match the questions that produced it. */
export class TypeSafeResponseError extends Error {
  public readonly problems: string[];
  public readonly body: unknown;

  constructor(problems: string[], body: unknown) {
    super(
      problems.length === 1
        ? `TypeSafe returned an unexpected response: ${problems[0]}`
        : `TypeSafe returned an unexpected response:\n  - ${problems.join('\n  - ')}`,
    );
    this.name = 'TypeSafeResponseError';
    this.problems = problems;
    this.body = body;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isProbability(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

/** Validate that every value of `probabilities` is a probability, and that the set sums to ~1. */
function checkProbabilities(
  probabilities: unknown,
  expectedKeys: string[],
  where: string,
  problems: string[],
): void {
  if (!isRecord(probabilities)) {
    problems.push(`${where}.probabilities is not an object`);
    return;
  }
  const got = Object.keys(probabilities);
  const missing = expectedKeys.filter((k) => !got.includes(k));
  const extra = got.filter((k) => !expectedKeys.includes(k));
  if (missing.length) problems.push(`${where}.probabilities is missing ${missing.join(', ')}`);
  if (extra.length) problems.push(`${where}.probabilities has unrequested ${extra.join(', ')}`);

  let total = 0;
  for (const [k, v] of Object.entries(probabilities)) {
    if (!isProbability(v)) {
      problems.push(`${where}.probabilities.${k} is not a probability (got ${String(v)})`);
      return;
    }
    total += v;
  }
  // The spec says "approximately 1". Anything outside this is a real problem,
  // not float noise.
  if (got.length > 0 && Math.abs(total - 1) > 0.02) {
    problems.push(`${where}.probabilities sums to ${total.toFixed(4)}, expected about 1`);
  }
}

function checkAnswer(name: string, question: Questions[string], answer: unknown, problems: string[]): void {
  const where = `answers.${name}`;
  if (!isRecord(answer)) {
    problems.push(`${where} is not an object`);
    return;
  }
  if (answer['type'] !== question.type) {
    problems.push(`${where}.type is "${String(answer['type'])}", expected "${question.type}"`);
    return;
  }

  switch (question.type) {
    case 'noul': {
      if (!isProbability(answer['noul'])) {
        problems.push(`${where}.noul is not a probability in [0, 1] (got ${String(answer['noul'])})`);
      }
      return;
    }
    case 'choice': {
      const offered = Object.keys(question.criteria);
      const picked = answer['choice'];
      if (typeof picked !== 'string') {
        problems.push(`${where}.choice is not a string`);
      } else if (!offered.includes(picked)) {
        // The important one: a choice outside the criteria breaks the literal
        // union the caller is relying on.
        problems.push(
          `${where}.choice is "${picked}", which was not one of the offered choices (${offered.join(', ')})`,
        );
      }
      if (!isProbability(answer['confidence'])) {
        problems.push(`${where}.confidence is not a probability in [0, 1]`);
      }
      checkProbabilities(answer['probabilities'], offered, where, problems);
      return;
    }
    case 'score': {
      const levels = question.criteria.map((_, i) => String(i));
      const value = answer['score'];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        problems.push(`${where}.score is not a number`);
      } else if (value < 0 || value > question.criteria.length - 1) {
        problems.push(
          `${where}.score is ${value}, outside the rubric range [0, ${question.criteria.length - 1}]`,
        );
      }
      if (!isProbability(answer['confidence'])) {
        problems.push(`${where}.confidence is not a probability in [0, 1]`);
      }
      if (!isRecord(answer['legend'])) {
        problems.push(`${where}.legend is not an object`);
      } else {
        const missing = levels.filter((l) => !(l in (answer['legend'] as object)));
        if (missing.length) problems.push(`${where}.legend is missing level(s) ${missing.join(', ')}`);
      }
      checkProbabilities(answer['probabilities'], levels, where, problems);
      return;
    }
  }
}

function checkUsage(usage: unknown, problems: string[]): void {
  if (!isRecord(usage)) {
    problems.push('usage is not an object');
    return;
  }
  for (const k of ['input_tokens', 'output_tokens'] as const) {
    if (typeof usage[k] !== 'number') problems.push(`usage.${k} is not a number`);
  }
}

/**
 * Check a decoded response body against the questions that produced it, and
 * return it typed. Throws {@link TypeSafeResponseError} listing every problem
 * found rather than the first, so one round trip tells you everything.
 */
export function validateResponse<Q extends Questions>(body: unknown, questions: Q): SystemOneResponse<Q> {
  const problems: string[] = [];

  if (!isRecord(body)) {
    throw new TypeSafeResponseError(['the response body is not an object'], body);
  }
  if (typeof body['model'] !== 'string') problems.push('model is not a string');

  const answers = body['answers'];
  if (!isRecord(answers)) {
    problems.push('answers is not an object');
  } else {
    for (const [name, question] of Object.entries(questions)) {
      if (!(name in answers)) {
        problems.push(`answers.${name} is missing, but it was asked`);
        continue;
      }
      checkAnswer(name, question, answers[name], problems);
    }
    for (const name of Object.keys(answers)) {
      if (!(name in questions)) problems.push(`answers.${name} was returned but never asked`);
    }
  }

  checkUsage(body['usage'], problems);

  if (problems.length) throw new TypeSafeResponseError(problems, body);
  return body as unknown as SystemOneResponse<Q>;
}

/**
 * Validate a questions map before it goes over the wire, so an empty rubric or
 * a zero-choice question fails here rather than as a 422 from the server.
 * Returns the problems; an empty array means it is fine.
 */
export function validateQuestions(questions: Questions): string[] {
  const problems: string[] = [];
  const names = Object.keys(questions);
  if (names.length === 0) problems.push('at least one question is required');

  for (const [name, q] of Object.entries(questions)) {
    if (q.type === 'choice') {
      const keys = Object.keys(q.criteria);
      if (keys.length < 2) {
        problems.push(`questions.${name}: a choice question needs at least two options`);
      }
    } else if (q.type === 'score') {
      if (q.criteria.length < 2) {
        problems.push(`questions.${name}: a score rubric needs at least two levels`);
      }
    }
  }
  return problems;
}

export type { Answer, Usage };
