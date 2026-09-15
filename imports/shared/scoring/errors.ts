import type { ValidationIssue } from './types';

export const validationIssue = (
  code: string,
  path: readonly (string | number)[],
  message: string,
): ValidationIssue => ({ code, path, message });

export class ScoringValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(`Scoring input is invalid: ${issues.length} issue(s).`);
    this.name = 'ScoringValidationError';
    this.issues = issues;
  }
}
