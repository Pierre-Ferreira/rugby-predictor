export class PlayerFixtureScoreError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PlayerFixtureScoreError';
    this.code = code;
  }
}
