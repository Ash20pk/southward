/**
 * Wire types for the TypeSafe System One API.
 *
 * Hand-derived from the published OpenAPI document at
 * https://api.typesafe.ai/openapi.json (TypeSafe 0.2.0), a copy of which is
 * vendored at specs/typesafe-openapi.json. Keep the two in step: if the spec
 * moves, these move with it.
 */

/**
 * Anything the API accepts where free-form content is allowed. The spec lets
 * `state`, `instructions` and every criteria value be a string, an object or
 * an array, so structured content does not have to be flattened into prose.
 */
export type Content = string | Record<string, unknown> | unknown[];

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

/** What counts as a yes and what counts as a no. */
export interface NoulCriteria {
  true?: Content | null;
  false?: Content | null;
}

/** A yes/no question, answered with the probability that the answer is yes. */
export interface NoulQuestion {
  type: 'noul';
  instructions?: Content | null;
  criteria?: NoulCriteria | null;
}

/** Choice name to a description of when that choice applies. */
export type ChoiceCriteria = Record<string, Content | null>;

/** A question that selects one option from the choices you define. */
export interface ChoiceQuestion<C extends ChoiceCriteria = ChoiceCriteria> {
  type: 'choice';
  instructions?: Content | null;
  criteria: C;
}

/**
 * Ordered rubric levels. Position is the score: the first entry is 0, the
 * second is 1, and so on.
 */
export type ScoreCriteria = readonly Content[];

/** A question that rates the content against an ordered rubric. */
export interface ScoreQuestion<L extends ScoreCriteria = ScoreCriteria> {
  type: 'score';
  instructions?: Content | null;
  criteria: L;
}

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

/** A named set of questions, all evaluated against the same state. */
export type Questions = Record<string, Question>;

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export interface NoulAnswer {
  type: 'noul';
  /**
   * Probability that the answer is yes, from 0 to 1. Near 1 favours yes, near
   * 0 favours no, and near 0.5 means the model is not sure. Render it as a
   * confidence, not a checkmark.
   */
  noul: number;
}

export interface ChoiceAnswer<K extends string = string> {
  type: 'choice';
  /** The choice with the highest probability. */
  choice: K;
  /** Confidence in that selection, from 0 to 1. */
  confidence: number;
  /** Probability of every choice, keyed by choice name. Sums to about 1. */
  probabilities: Record<K, number>;
}

export interface ScoreAnswer<K extends string = string> {
  type: 'score';
  /**
   * Probability-weighted average of the rubric levels, so it can land between
   * two integer levels.
   */
  score: number;
  /** Confidence in the score, from 0 to 1. */
  confidence: number;
  /** The rubric you supplied, keyed by its level, so the score is readable. */
  legend: Record<K, Content>;
  /** Probability of each level, keyed the same way as `legend`. */
  probabilities: Record<K, number>;
}

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

// ---------------------------------------------------------------------------
// Requests and responses
// ---------------------------------------------------------------------------

export interface Usage {
  input_tokens: number;
  /** Output tokens are free of charge at the time of writing. */
  output_tokens: number;
}

export interface SystemOneRequest<Q extends Questions = Questions> {
  state: Content;
  /** Required on the wire. The client fills it in when you omit it. */
  model?: string;
  questions: Q;
}

export interface SystemOneResponse<Q extends Questions = Questions> {
  /** The model that actually answered. May differ from the alias you asked for. */
  model: string;
  answers: AnswersFor<Q>;
  usage: Usage;
}

export interface ModelMetadata {
  name: string;
  description: string;
  release_date: string;
}

// ---------------------------------------------------------------------------
// The inference. This is the part that earns the name.
// ---------------------------------------------------------------------------

/**
 * The index positions of a rubric tuple, as the string keys the API uses in
 * `legend` and `probabilities`. A three-level rubric gives `"0" | "1" | "2"`.
 * A non-tuple array widens to `string`, which is the honest answer for a
 * rubric whose length is not known at compile time.
 */
export type ScoreLevels<L extends ScoreCriteria> = number extends L['length']
  ? string
  : Extract<Exclude<keyof L, keyof unknown[]>, string>;

/** The answer type implied by a single question. */
export type AnswerFor<Q extends Question> = Q extends ScoreQuestion<infer L>
  ? ScoreAnswer<ScoreLevels<L>>
  : Q extends ChoiceQuestion<infer C>
    ? ChoiceAnswer<Extract<keyof C, string>>
    : Q extends NoulQuestion
      ? NoulAnswer
      : never;

/** The answers map implied by a questions map. Same keys, answer per key. */
export type AnswersFor<Q extends Questions> = { [K in keyof Q]: AnswerFor<Q[K]> };
