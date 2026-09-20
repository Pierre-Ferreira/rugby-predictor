export const PREDICTION_METHODS = {
  getFixtureLeaderboard: 'predictions.getFixtureLeaderboard',
  getMyFixtureScore: 'predictions.getMyFixtureScore',
  submit: 'predictions.submit',
} as const;

export const TEST_PREDICTION_METHODS = {
  currentUserEntry: 'test.predictions.currentUserEntry',
  reset: 'test.predictions.reset',
} as const;
