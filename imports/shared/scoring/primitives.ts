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
  const difference = Math.abs(prediction - observed);
  const deduction = difference * rate;

  if (!Number.isSafeInteger(difference) || !Number.isSafeInteger(deduction)) {
    throw new ArithmeticSafetyError([
      {
        code: 'unsafe_arithmetic',
        path: [],
        message: 'Numeric deduction is outside the safe integer range.',
      },
    ]);
  }

  return { difference, deduction };
};

export const scoreCategoricalAnswer = (
  prediction: string,
  observed: string,
  incorrectDeduction: number,
): CategoricalScore => ({
  deduction: prediction === observed ? 0 : incorrectDeduction,
});

export const addSafe = (
  values: readonly number[],
  path: readonly (string | number)[] = [],
): number => {
  let total = 0;

  for (const value of values) {
    total += value;

    if (!Number.isSafeInteger(total)) {
      throw new ArithmeticSafetyError([
        {
          code: 'unsafe_arithmetic',
          path,
          message: 'Total deduction is outside the safe integer range.',
        },
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
