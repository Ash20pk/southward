/**
 * Question builders.
 *
 * These are thin: each one returns the plain wire object the API expects. The
 * work they do is in the type signature. Every builder uses a `const` type
 * parameter so the literal shape of your criteria survives into the return
 * type, which is what lets the client infer the answer type later.
 *
 * You can always hand-write the object literal instead. The builders exist so
 * that `as const` is not something you have to remember.
 */
import type {
  ChoiceCriteria,
  ChoiceQuestion,
  Content,
  NoulCriteria,
  NoulQuestion,
  ScoreCriteria,
  ScoreQuestion,
} from '../types/index';

export interface NoulInit {
  /** The yes/no question, or a statement to judge as true or false. */
  instructions?: Content | null;
  /** Optional clarification of what counts as a yes and what counts as a no. */
  criteria?: NoulCriteria | null;
}

/**
 * A yes/no question. The answer is a probability, not a boolean.
 *
 * ```ts
 * noul({ instructions: 'Does this convey time-sensitivity?' })
 * ```
 */
export function noul(init: NoulInit = {}): NoulQuestion {
  const q: NoulQuestion = { type: 'noul' };
  if (init.instructions !== undefined) q.instructions = init.instructions;
  if (init.criteria !== undefined) q.criteria = init.criteria;
  return q;
}

export interface ChoiceInit<C extends ChoiceCriteria> {
  /** What the model should decide when picking an option. */
  instructions?: Content | null;
  /**
   * The options, as a map of choice name to a description of when it applies.
   * A choice with a `null` description is read by its name alone.
   */
  criteria: C;
}

/**
 * Pick one option. The answer's `choice` is typed as the union of your keys,
 * so a typo in a downstream comparison is a compile error.
 *
 * ```ts
 * choice({ criteria: { billing: 'Money', bug: 'Broken', feature: 'A request' } })
 * // answer.choice is 'billing' | 'bug' | 'feature'
 * ```
 */
export function choice<const C extends ChoiceCriteria>(init: ChoiceInit<C>): ChoiceQuestion<C> {
  const q: ChoiceQuestion<C> = { type: 'choice', criteria: init.criteria };
  if (init.instructions !== undefined) q.instructions = init.instructions;
  return q;
}

export interface ScoreInit<L extends ScoreCriteria> {
  /** What the model should rate. */
  instructions?: Content | null;
  /**
   * An ordered rubric. Position is the score, starting at zero, so the order
   * matters and should run from lowest to highest.
   */
  criteria: L;
}

/**
 * Rate against an ordered rubric. The returned `score` is a probability-weighted
 * average, so it can land between levels; `legend` maps each level back to the
 * description you gave it.
 *
 * ```ts
 * score({ criteria: ['Can wait', 'This week', 'Today'] })
 * // answer.score is a number in [0, 2]; answer.legend is keyed '0' | '1' | '2'
 * ```
 */
export function score<const L extends ScoreCriteria>(init: ScoreInit<L>): ScoreQuestion<L> {
  const q: ScoreQuestion<L> = { type: 'score', criteria: init.criteria };
  if (init.instructions !== undefined) q.instructions = init.instructions;
  return q;
}
