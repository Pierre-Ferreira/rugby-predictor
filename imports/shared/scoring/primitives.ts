import { ScoringValidationError, validationIssue } from './errors';
import type { ValidationIssue } from './types';

export interface NumericScore {
  readonly difference: number;
  readonly deduction: number;
}

export interface CategoricalScore {
  readonly deduction: number;
}

export const scoreNumericDifference = (
  prediction: number,
  observed: number,
  rate: number,
): NumericScore => {
  const issues: ValidationIssue[] = [];

  validateSafeNonNegativeInteger(prediction, ['prediction'], issues);
  validateSafeNonNegativeInteger(observed, ['observed'], issues);
  validatePositiveSafeInteger(rate, ['rate'], issues);

  if (issues.length > 0) {
    throw new ScoringValidationError(issues);
  }

  const difference = Math.abs(prediction - observed);
  const deduction = difference * rate;

  if (!Number.isSafeInteger(difference) || !Number.isSafeInteger(deduction)) {
    throw new ScoringValidationError([
      validationIssue(
        'unsafe_arithmetic',
        [],
        'Numeric deduction is outside the safe integer range.',
      ),
    ]);
  }

  return { difference, deduction };
};

export const scoreCategoricalAnswer = (
  prediction: string,
  observed: string,
  incorrectDeduction: number,
): CategoricalScore => {
  const issues: ValidationIssue[] = [];

  validateNonEmptyString(prediction, ['prediction'], issues);
  validateNonEmptyString(observed, ['observed'], issues);
  validatePositiveSafeInteger(
    incorrectDeduction,
    ['incorrectDeduction'],
    issues,
  );

  if (issues.length > 0) {
    throw new ScoringValidationError(issues);
  }

  return {
    deduction: prediction === observed ? 0 : incorrectDeduction,
  };
};

export const addSafe = (
  values: readonly number[],
  path: readonly (string | number)[] = [],
): number => {
  if (!Array.isArray(values)) {
    throw new ScoringValidationError([
      validationIssue(
        'invalid_numeric_answer',
        path,
        'Values must be an array of finite, non-negative safe integers.',
      ),
    ]);
  }

  let total = 0;

  for (const [index, value] of values.entries()) {
    validateSafeNonNegativeInteger(value, [...path, index]);

    total += value;

    if (!Number.isSafeInteger(total)) {
      throw new ScoringValidationError([
        validationIssue(
          'unsafe_arithmetic',
          path,
          'Total deduction is outside the safe integer range.',
        ),
      ]);
    }
  }

  return total;
};

export class ArithmeticSafetyError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super('Scoring arithmetic produced an unsafe integer result.');
    this.name = 'ArithmeticSafetyError';
    this.issues = issues;
  }
}

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  Number.isSafeInteger(value) &&
  value >= 0;

const validateSafeNonNegativeInteger = (
  value: unknown,
  path: readonly (string | number)[],
  issues?: ValidationIssue[],
): void => {
  if (isSafeNonNegativeInteger(value)) {
    return;
  }

  const nextIssue = validationIssue(
    'invalid_numeric_answer',
    path,
    'Numeric values must be finite, non-negative safe integers.',
  );

  if (issues) {
    issues.push(nextIssue);
    return;
  }

  throw new ScoringValidationError([nextIssue]);
};

const validatePositiveSafeInteger = (
  value: unknown,
  path: readonly (string | number)[],
  issues: ValidationIssue[],
): void => {
  if (isSafeNonNegativeInteger(value) && value > 0) {
    return;
  }

  issues.push(
    validationIssue(
      path.at(-1) === 'incorrectDeduction'
        ? 'invalid_deduction'
        : 'invalid_rate',
      path,
      'Rates and deductions must be positive safe integers.',
    ),
  );
};

const validateNonEmptyString = (
  value: unknown,
  path: readonly (string | number)[],
  issues: ValidationIssue[],
): void => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return;
  }

  issues.push(
    validationIssue(
      'invalid_answer',
      path,
      'Categorical answers must be non-empty strings.',
    ),
  );
};
