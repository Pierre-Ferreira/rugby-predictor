import type { FixtureDocument } from '/imports/shared/fixtures';
import { formatUtcInstantForJohannesburgDisplay } from '/imports/shared/fixtures';

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

export const kickoffLabel = (fixture: FixtureDocument): string =>
  formatUtcInstantForJohannesburgDisplay(fixture.scheduledKickoffAt);

export const fixtureDetailPath = (fixtureId: string): string =>
  `/games/${fixtureId}`;
