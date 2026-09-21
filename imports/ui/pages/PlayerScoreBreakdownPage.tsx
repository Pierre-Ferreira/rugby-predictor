import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';

import { Fixtures } from '/imports/api/fixtures/collection';
import { signInPathForReturnTo } from '/imports/shared/auth/redirects';
import {
  FIXTURE_PUBLICATIONS,
  type FixtureDocument,
} from '/imports/shared/fixtures';
import {
  buildPlayerScoreBreakdownViewModel,
  type PlayerFixtureScoreProjection,
  type PlayerScoreBreakdownItemStatus,
  type PlayerScoreBreakdownRow,
  type PlayerScoreBreakdownSection,
  type PlayerScoreBreakdownTone,
  type PlayerScoreBreakdownViewModel,
} from '/imports/shared/playerFixtureScores';
import {
  PREDICTION_METHODS,
  PREDICTION_PUBLICATIONS,
} from '/imports/shared/predictions';
import { callMeteorMethod } from '../auth/methodCall';
import { useAuthState } from '../auth/useAuthState';
import { SignInRequiredState } from '../components/AuthStates';
import { AppLink } from '../components/AppLink';
import {
  PlayerEmptyState,
  PlayerErrorState,
  PlayerLoadingState,
  PlayerPage,
  PlayerPageHeader,
  RugbyRoosterPersonality,
  StatusBadge as PlayerStatusBadge,
  type RugbyRoosterMood,
} from '../components/player';
import {
  fixtureDetailPath,
  fixtureLeaderboardPath,
  fixturePlayerStatusLabel,
  fixturePlayerStatusTone,
  fixturePredictionPath,
  kickoffLabel,
} from '../fixtures/fixtureUi';

const refreshIntervalMs = 15_000;

const fixtureIdFromLocation = (): string =>
  window.location.pathname.split('/').filter(Boolean)[1] ?? '';

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const message = (error as { readonly message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }
  }

  return 'Your score breakdown could not be loaded.';
};

const ScoreBreakdownShell = ({
  children,
}: {
  readonly children: ReactNode;
}) => <PlayerPage maxWidth="narrow">{children}</PlayerPage>;

type ScopedScoreState = {
  readonly fixtureId: string;
  readonly projection: PlayerFixtureScoreProjection | null;
};

type ScopedScoreError = {
  readonly fixtureId: string;
  readonly message: string;
};

export const PlayerScoreBreakdownPage = () => {
  const fixtureId = fixtureIdFromLocation();
  const auth = useAuthState();
  const requestId = useRef(0);
  const scoreRef = useRef<ScopedScoreState | null>(null);
  const [scoreState, setScoreState] = useState<ScopedScoreState | null>(null);
  const [initialError, setInitialError] = useState<ScopedScoreError | null>(
    null,
  );
  const [refreshError, setRefreshError] = useState<ScopedScoreError | null>(
    null,
  );
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { fixture, isConnected, isReady } = useTracker(() => {
    const publicFixtureHandle = Meteor.subscribe(
      FIXTURE_PUBLICATIONS.publicDetail,
      fixtureId,
    );
    const userId = Meteor.userId();
    const privateFixtureHandle = userId
      ? Meteor.subscribe(PREDICTION_PUBLICATIONS.fixtureContext, fixtureId)
      : null;

    return {
      fixture: Fixtures.findOne({
        _id: fixtureId,
        visibility: 'published',
      }),
      isConnected: Meteor.status().connected,
      isReady:
        publicFixtureHandle.ready() && (privateFixtureHandle?.ready() ?? true),
    };
  }, [fixtureId, auth.userId]);

  const hasFixture = Boolean(fixture);
  const hasRuleset = Boolean(fixture?.rulesetSnapshot);
  const activeScoreState =
    scoreState?.fixtureId === fixtureId ? scoreState : null;
  const activeInitialError =
    initialError?.fixtureId === fixtureId ? initialError.message : null;
  const activeRefreshError =
    refreshError?.fixtureId === fixtureId ? refreshError.message : null;
  const canRequestScore =
    auth.isAuthenticated &&
    auth.isVerified &&
    isReady &&
    hasFixture &&
    hasRuleset;

  useEffect(() => {
    scoreRef.current = activeScoreState;
  }, [activeScoreState]);

  const loadScore = useCallback(
    async ({ quiet = false }: { readonly quiet?: boolean } = {}) => {
      const currentRequestId = requestId.current + 1;

      requestId.current = currentRequestId;

      if (scoreRef.current || quiet) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
      }

      try {
        const projection =
          await callMeteorMethod<PlayerFixtureScoreProjection | null>(
            PREDICTION_METHODS.getMyFixtureScore,
            fixtureId,
          );

        if (requestId.current !== currentRequestId) {
          return;
        }

        setScoreState({ fixtureId, projection });
        setInitialError((previous) =>
          previous?.fixtureId === fixtureId ? null : previous,
        );
        setRefreshError((previous) =>
          previous?.fixtureId === fixtureId ? null : previous,
        );
      } catch (error) {
        if (requestId.current !== currentRequestId) {
          return;
        }

        const message = errorMessage(error);

        if (scoreRef.current) {
          setRefreshError({ fixtureId, message });
        } else {
          setInitialError({ fixtureId, message });
        }
      } finally {
        if (requestId.current === currentRequestId) {
          setIsInitialLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [fixtureId],
  );

  useEffect(() => {
    if (!canRequestScore) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadScore();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [canRequestScore, fixtureId, loadScore]);

  useEffect(() => {
    const projection = activeScoreState?.projection;

    if (
      !projection ||
      projection.status === 'final' ||
      projection.status === 'cancelled'
    ) {
      return;
    }

    const refreshLoadedScore = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void loadScore({ quiet: true });
    };
    const interval = window.setInterval(refreshLoadedScore, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [activeScoreState, loadScore]);

  const fixtureTitle = fixture
    ? `${fixture.team1DisplayName} vs ${fixture.team2DisplayName}`
    : 'Fixture score';

  if (!isConnected && !isReady) {
    return (
      <ScoreBreakdownShell>
        <PlayerErrorState
          body="Reconnect to Rugby Rooster to load your score."
          title="Score breakdown is unavailable right now"
        />
      </ScoreBreakdownShell>
    );
  }

  if (!isReady || auth.isLoading) {
    return (
      <ScoreBreakdownShell>
        <PlayerLoadingState label="Loading score breakdown" />
      </ScoreBreakdownShell>
    );
  }

  if (!fixture) {
    return (
      <ScoreBreakdownShell>
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
      </ScoreBreakdownShell>
    );
  }

  if (!auth.isAuthenticated || !auth.isVerified) {
    return (
      <ScoreBreakdownShell>
        <ScoreFixtureHeader fixture={fixture} />
        <SignInRequiredState
          currentPath={window.location.pathname}
          message="Sign in with the existing email-link flow to view your fixture score breakdown."
          signInPath={signInPathForReturnTo(window.location.pathname)}
          title={`Your score for ${fixtureTitle}`}
        />
      </ScoreBreakdownShell>
    );
  }

  if (!fixture.rulesetSnapshot) {
    return (
      <ScoreBreakdownShell>
        <ScoreFixtureHeader fixture={fixture} />
        <section
          className="rounded-md border border-rooster-red/30 bg-white p-6"
          role="alert"
        >
          <h1 className="text-2xl font-black text-rooster-ink">
            Score rules unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-rooster-muted">
            This fixture cannot show a score breakdown because its stored
            ruleset snapshot is missing.
          </p>
        </section>
      </ScoreBreakdownShell>
    );
  }

  const viewModel = activeScoreState
    ? buildPlayerScoreBreakdownViewModel({
        fixture,
        scoreProjection: activeScoreState.projection,
      })
    : null;

  return (
    <ScoreBreakdownShell>
      <ScoreFixtureHeader fixture={fixture} />

      {(isInitialLoading || (canRequestScore && !activeInitialError)) &&
      !viewModel ? (
        <PlayerLoadingState label="Loading score breakdown" />
      ) : null}

      {activeInitialError && !viewModel ? (
        <PlayerErrorState
          action={
            <button
              className="focus-ring rr-button rr-button-danger"
              type="button"
              onClick={() => void loadScore()}
            >
              Retry
            </button>
          }
          body={activeInitialError}
          title="Score breakdown unavailable"
        />
      ) : null}

      {viewModel ? (
        <>
          <ScoreSummaryPanel
            fixtureId={fixture._id}
            isRefreshing={isRefreshing}
            refreshError={activeRefreshError}
            viewModel={viewModel}
            onRefresh={() => void loadScore()}
          />

          <ScoreBreakdownSections sections={viewModel.sections} />
        </>
      ) : null}
    </ScoreBreakdownShell>
  );
};

const ScoreFixtureHeader = ({
  fixture,
}: {
  readonly fixture: FixtureDocument;
}) => (
  <PlayerPageHeader
    actions={
      <>
        <AppLink
          className="focus-ring rr-button rr-button-secondary"
          to={fixtureDetailPath(fixture._id)}
        >
          Back to fixture
        </AppLink>
        <AppLink
          className="focus-ring rr-button rr-button-secondary"
          to={fixtureLeaderboardPath(fixture._id)}
        >
          Leaderboard
        </AppLink>
        <AppLink
          className="focus-ring rr-button rr-button-secondary"
          to={fixturePredictionPath(fixture._id)}
        >
          Prediction
        </AppLink>
      </>
    }
    eyebrow={
      <>
        <PlayerStatusBadge
          label={fixturePlayerStatusLabel(fixture)}
          tone={fixturePlayerStatusTone(fixture)}
        />
        <span>{fixture.competitionDisplayName}</span>
      </>
    }
    meta={<span>Kickoff: {kickoffLabel(fixture)}</span>}
    subtitle="Your score breakdown explains what resolved, what is pending, and where deductions came from."
    title={
      <>
        {fixture.team1DisplayName} <span className="rr-versus">vs</span>{' '}
        {fixture.team2DisplayName}
      </>
    }
  />
);

const scorePersonalityForViewModel = (
  viewModel: PlayerScoreBreakdownViewModel,
): { readonly message: string; readonly mood: RugbyRoosterMood } => {
  if (viewModel.status === 'no_prediction') {
    return {
      message: 'You sat this one out.',
      mood: 'shocked',
    };
  }

  if (viewModel.status === 'awaiting_result') {
    return {
      message: 'Hmm...',
      mood: 'thinking',
    };
  }

  if (viewModel.status === 'cancelled') {
    return {
      message: 'Match called off.',
      mood: 'disappointed',
    };
  }

  const score = Number(viewModel.scoreLabel?.replace(/[^\d]/g, '') ?? NaN);
  const pendingCount = Number(
    viewModel.summaryRows
      .find((row) => row.label === 'Pending predictions')
      ?.value.replace(/[^\d]/g, '') ?? NaN,
  );

  if (Number.isFinite(score) && score === 0) {
    return {
      message: "We don't talk about this one.",
      mood: 'superCooked',
    };
  }

  if (Number.isFinite(score) && score <= 6000) {
    return {
      message: 'Cooked.',
      mood: 'cooked',
    };
  }

  if (Number.isFinite(score) && score <= 8000) {
    return {
      message: 'That one hurt.',
      mood: 'disappointed',
    };
  }

  if (viewModel.status === 'provisional' && Number.isFinite(pendingCount)) {
    return pendingCount > 0
      ? {
          message: 'This could move.',
          mood: 'nervous',
        }
      : {
          message: 'Pick boldly. Crow later.',
          mood: 'confident',
        };
  }

  if (Number.isFinite(score) && score >= 9500) {
    return {
      message: 'You knew your rugby.',
      mood: 'celebrating',
    };
  }

  return {
    message: viewModel.status === 'provisional' ? 'Still alive.' : 'Not bad.',
    mood: 'confident',
  };
};

const ScoreSummaryPanel = ({
  fixtureId,
  isRefreshing,
  onRefresh,
  refreshError,
  viewModel,
}: {
  readonly fixtureId: string;
  readonly isRefreshing: boolean;
  readonly onRefresh: () => void;
  readonly refreshError: string | null;
  readonly viewModel: PlayerScoreBreakdownViewModel;
}) => {
  const canRefresh =
    viewModel.status === 'awaiting_result' ||
    viewModel.status === 'provisional';
  const personality = scorePersonalityForViewModel(viewModel);

  return (
    <section className="rr-surface rr-surface--raised">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="rr-section-eyebrow">Your score</p>
          <h2 className="rr-section-title mt-2">{viewModel.title}</h2>
          {viewModel.scoreLabel ? (
            <p className="mt-3 text-4xl font-black leading-none text-rooster-ink sm:text-5xl">
              {viewModel.scoreLabel}
            </p>
          ) : null}
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-rooster-muted">
            {viewModel.notice}
          </p>
        </div>
        <RugbyRoosterPersonality
          message={personality.message}
          mood={personality.mood}
          size="compact"
        />
        {canRefresh ? (
          <button
            className="focus-ring rr-button rr-button-secondary"
            disabled={isRefreshing}
            type="button"
            onClick={onRefresh}
          >
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        ) : null}
      </div>

      {viewModel.summaryRows.length > 0 ? (
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {viewModel.summaryRows.map((row) => (
            <div
              className="rounded-md border border-rooster-line bg-rooster-paper p-3"
              key={row.label}
            >
              <dt className="text-xs font-black uppercase text-rooster-muted">
                {row.label}
              </dt>
              <dd
                className={[
                  'mt-1 break-words text-lg font-black',
                  toneTextClassName(row.tone),
                ].join(' ')}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {viewModel.status === 'no_prediction' ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <AppLink
            className="focus-ring rr-button rr-button-primary"
            to={fixturePredictionPath(fixtureId)}
          >
            View prediction page
          </AppLink>
          <AppLink
            className="focus-ring rr-button rr-button-secondary"
            to={fixtureLeaderboardPath(fixtureId)}
          >
            View leaderboard
          </AppLink>
        </div>
      ) : null}

      {refreshError ? (
        <p
          className="mt-4 rounded-md border border-rooster-red/30 bg-rooster-red/10 p-3 text-sm font-bold text-rooster-ink"
          role="status"
        >
          Refresh failed. {refreshError}
        </p>
      ) : null}
    </section>
  );
};

const ScoreBreakdownSections = ({
  sections,
}: {
  readonly sections: readonly PlayerScoreBreakdownSection[];
}) => {
  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4">
      {sections.map((section) => (
        <ScoreBreakdownSection key={section.id} section={section} />
      ))}
    </div>
  );
};

const ScoreBreakdownSection = ({
  section,
}: {
  readonly section: PlayerScoreBreakdownSection;
}) => (
  <section className="rr-surface">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="break-words text-sm font-black uppercase text-rooster-ink">
          {section.title}
        </h2>
        {section.prompt ? (
          <p className="mt-2 break-words text-sm font-semibold leading-6 text-rooster-muted">
            {section.prompt}
          </p>
        ) : null}
      </div>
      {section.statusLabel ? (
        <StatusBadge
          label={section.statusLabel}
          status={
            section.statusLabel === 'Void'
              ? 'void'
              : section.statusLabel.includes('pending')
                ? 'pending'
                : 'resolved'
          }
        />
      ) : null}
    </div>
    <div className="mt-4">
      {section.rows.map((row) => (
        <ScoreBreakdownRowView key={row.id} row={row} />
      ))}
    </div>
  </section>
);

const ScoreBreakdownRowView = ({
  row,
}: {
  readonly row: PlayerScoreBreakdownRow;
}) => (
  <article className="border-t border-rooster-line py-4 first:border-t-0 first:pt-0 last:pb-0">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        {row.itemLabel ? (
          <p className="break-words text-sm font-black text-rooster-ink">
            {row.itemLabel}
          </p>
        ) : null}
        <dl className="mt-2 grid gap-3 rounded-md bg-rr-bg p-3 sm:grid-cols-2">
          <ScoreDetail
            label={row.predictionHeading}
            value={row.predictionLabel}
          />
          <ScoreDetail label={row.actualHeading} value={row.actualLabel} />
        </dl>
        {row.voidNote ? (
          <p className="mt-2 text-xs font-semibold leading-5 text-rooster-muted">
            {row.voidNote}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3 sm:block sm:min-w-28 sm:text-right">
        <StatusBadge
          label={row.statusLabel}
          status={row.status}
          tone={row.tone}
        />
        <p
          className={[
            'text-lg font-black sm:mt-2',
            toneTextClassName(row.tone),
          ].join(' ')}
        >
          {row.deductionLabel}
        </p>
      </div>
    </div>
  </article>
);

const ScoreDetail = ({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) => (
  <div className="min-w-0">
    <dt className="text-xs font-black uppercase text-rooster-muted">{label}</dt>
    <dd className="mt-1 break-words text-sm font-black text-rooster-ink">
      {value}
    </dd>
  </div>
);

const StatusBadge = ({
  label,
  status,
  tone,
}: {
  readonly label: string;
  readonly status: PlayerScoreBreakdownItemStatus;
  readonly tone?: PlayerScoreBreakdownTone;
}) => (
  <span
    className={[
      'inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase',
      statusBadgeClassName(status, tone),
    ].join(' ')}
  >
    {label}
  </span>
);

const statusBadgeClassName = (
  status: PlayerScoreBreakdownItemStatus,
  tone?: PlayerScoreBreakdownTone,
): string => {
  if (status === 'pending') {
    return 'border-rooster-sun/70 bg-rooster-sun/20 text-rooster-ink';
  }

  if (status === 'void') {
    return 'border-rooster-line bg-rooster-paper text-rooster-muted';
  }

  if (tone === 'deduction') {
    return 'border-rooster-red/30 bg-rooster-red/10 text-rooster-red';
  }

  return 'border-rooster-grass/30 bg-rooster-grass/10 text-rooster-grass';
};

const toneTextClassName = (tone: PlayerScoreBreakdownTone): string => {
  if (tone === 'deduction') {
    return 'text-rooster-red';
  }

  if (tone === 'pending') {
    return 'text-rooster-ink';
  }

  if (tone === 'void') {
    return 'text-rooster-muted';
  }

  return 'text-rooster-ink';
};
