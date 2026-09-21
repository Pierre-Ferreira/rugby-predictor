import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { useState } from 'react';

import { Fixtures } from '/imports/api/fixtures/collection';
import { FIXTURE_PUBLICATIONS } from '/imports/shared/fixtures';
import { AppLink } from '../components/AppLink';
import {
  PlayerEmptyState,
  PlayerErrorState,
  PlayerLoadingState,
  PlayerPage,
  PlayerPageHeader,
  RugbyRoosterPersonality,
  StatusBadge,
} from '../components/player';
import {
  fixtureLeaderboardPath,
  fixturePlayerStatusLabel,
  fixturePlayerStatusTone,
  fixturePredictionPath,
  kickoffLabel,
} from '../fixtures/fixtureUi';

const fixtureIdFromLocation = (): string =>
  window.location.pathname.split('/').filter(Boolean)[1] ?? '';

export const GameDetailPage = () => {
  const fixtureId = fixtureIdFromLocation();
  const [nowMs] = useState(() => Date.now());
  const { fixture, isConnected, isReady } = useTracker(() => {
    const handle = Meteor.subscribe(
      FIXTURE_PUBLICATIONS.publicDetail,
      fixtureId,
    );

    return {
      fixture: Fixtures.findOne({
        _id: fixtureId,
        visibility: 'published',
      }),
      isConnected: Meteor.status().connected,
      isReady: handle.ready(),
    };
  }, [fixtureId]);

  if (!isConnected && !isReady) {
    return (
      <PlayerPage>
        <PlayerErrorState
          body="Reconnect to Rugby Rooster to load this fixture."
          title="Fixture is unavailable right now"
        />
      </PlayerPage>
    );
  }

  if (!isReady) {
    return (
      <PlayerPage>
        <PlayerLoadingState label="Loading fixture" />
      </PlayerPage>
    );
  }

  if (!fixture) {
    return (
      <PlayerPage>
        <PlayerEmptyState
          action={
            <AppLink
              className="focus-ring rr-button rr-button-primary"
              to="/games"
            >
              Back to games
            </AppLink>
          }
          body="Draft fixtures and unknown fixture links are not publicly available."
          mood="thinking"
          title="Fixture not found"
        />
      </PlayerPage>
    );
  }

  return (
    <PlayerPage>
      <PlayerPageHeader
        actions={
          <>
            <AppLink
              className="focus-ring rr-button rr-button-primary"
              to={fixturePredictionPath(fixture._id)}
            >
              Enter prediction
            </AppLink>
            <AppLink
              className="focus-ring rr-button rr-button-secondary"
              to={fixtureLeaderboardPath(fixture._id)}
            >
              Leaderboard
            </AppLink>
            <AppLink
              className="focus-ring rr-button rr-button-ghost"
              to="/games"
            >
              Back to games
            </AppLink>
          </>
        }
        eyebrow={
          <>
            <StatusBadge
              label={fixturePlayerStatusLabel(fixture, nowMs)}
              tone={fixturePlayerStatusTone(fixture, nowMs)}
            />
            <span>{fixture.competitionDisplayName}</span>
          </>
        }
        meta={
          <span>
            Kickoff: {kickoffLabel(fixture)}
            {fixture.venueDisplayName
              ? ` | ${fixture.venueDisplayName}`
              : ' | Venue to be confirmed'}
          </span>
        }
        personality={
          <RugbyRoosterPersonality
            message="Big game. Bigger call."
            mood="thinking"
            size="standard"
          />
        }
        subtitle="Make your fixture call before scheduled kickoff, then come back for the leaderboard and your score breakdown."
        title={
          <>
            {fixture.team1DisplayName} <span className="rr-versus">vs</span>{' '}
            {fixture.team2DisplayName}
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <dl className="rr-mini-stat">
          <dt>Competition</dt>
          <dd>{fixture.competitionDisplayName}</dd>
        </dl>
        <dl className="rr-mini-stat">
          <dt>Kickoff</dt>
          <dd>{kickoffLabel(fixture)}</dd>
        </dl>
        <dl className="rr-mini-stat">
          <dt>Venue</dt>
          <dd>{fixture.venueDisplayName ?? 'Venue to be confirmed'}</dd>
        </dl>
      </section>
    </PlayerPage>
  );
};
