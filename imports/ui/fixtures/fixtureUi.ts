import type { FixtureDocument } from '/imports/shared/fixtures';
import { formatUtcInstantForJohannesburgDisplay } from '/imports/shared/fixtures';
import { resolvePredictionAccess } from '/imports/shared/predictionAccess';
import type { PlayerStatusTone } from '../components/player';

export const fixtureStatusLabel = (fixture: FixtureDocument): string => {
  if (fixture.isCancelled) {
    return 'Cancelled';
  }

  return fixture.visibility === 'published' ? 'Published' : 'Draft';
};

export const fixtureStatusClassName = (fixture: FixtureDocument): string => {
  if (fixture.isCancelled) {
    return 'border-rooster-red/30 bg-rooster-red/10 text-rooster-red';
  }

  if (fixture.visibility === 'published') {
    return 'border-rooster-grass/30 bg-rooster-grass/10 text-rooster-grass';
  }

  return 'border-rooster-line bg-rooster-paper text-rooster-muted';
};

export const fixturePlayerStatusLabel = (
  fixture: FixtureDocument,
  nowMs = Date.now(),
): string => {
  if (fixture.isCancelled) {
    return 'Cancelled';
  }

  const access = resolvePredictionAccess({
    fixture,
    hasResultTrackingStarted: false,
    now: new Date(nowMs),
  });

  return access.isOpen ? 'Prediction open' : 'Locked';
};

export const fixturePlayerStatusTone = (
  fixture: FixtureDocument,
  nowMs = Date.now(),
): PlayerStatusTone => {
  if (fixture.isCancelled) {
    return 'danger';
  }

  const access = resolvePredictionAccess({
    fixture,
    hasResultTrackingStarted: false,
    now: new Date(nowMs),
  });

  return access.isOpen ? 'success' : 'warning';
};

export const kickoffLabel = (fixture: FixtureDocument): string =>
  formatUtcInstantForJohannesburgDisplay(fixture.scheduledKickoffAt);

export const fixtureDetailPath = (fixtureId: string): string =>
  `/games/${fixtureId}`;

export const fixturePredictionPath = (fixtureId: string): string =>
  `/games/${fixtureId}/predict`;

export const fixtureLeaderboardPath = (fixtureId: string): string =>
  `/games/${fixtureId}/leaderboard`;

export const fixtureScoreBreakdownPath = (fixtureId: string): string =>
  `/games/${fixtureId}/my-score`;

export const fixtureResultsPath = (fixtureId: string): string =>
  `/admin/fixtures/${fixtureId}/results`;
