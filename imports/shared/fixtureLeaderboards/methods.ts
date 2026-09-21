import { PREDICTION_METHODS } from '/imports/shared/predictions/methods';

export const DEFAULT_FIXTURE_LEADERBOARD_LIMIT = 50;
export const MAX_FIXTURE_LEADERBOARD_LIMIT = 100;
export const MAX_FIXTURE_LEADERBOARD_OFFSET = 1_000_000;

export const FIXTURE_LEADERBOARD_METHODS = {
  getFixtureLeaderboard: PREDICTION_METHODS.getFixtureLeaderboard,
} as const;

export const TEST_FIXTURE_LEADERBOARD_METHODS = {
  seedIdentityScenario: 'test.fixtureLeaderboards.seedIdentityScenario',
  seedScenario: 'test.fixtureLeaderboards.seedScenario',
  updateScenarioResult: 'test.fixtureLeaderboards.updateScenarioResult',
} as const;
