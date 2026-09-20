export class FixtureLeaderboardError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FixtureLeaderboardError';
    this.code = code;
  }
}
