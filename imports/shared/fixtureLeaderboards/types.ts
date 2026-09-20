import type { FixtureDocument } from '/imports/shared/fixtures';
import type { MatchResultDocument } from '/imports/shared/matchResults';
import type { PlayerFixtureScoreStatus } from '/imports/shared/playerFixtureScores';
import type { PredictionEntryDocument } from '/imports/shared/predictions';

export type FixtureLeaderboardStatus = PlayerFixtureScoreStatus;

export interface FixtureLeaderboardPage {
  readonly offset: number;
  readonly limit: number;
  readonly returnedCount: number;
  readonly hasMore: boolean;
}

export interface FixtureLeaderboardRow {
  readonly rowId: string;
  readonly place: number;
  readonly displayLabel: string;
  readonly score: number;
  readonly pendingCount: number;
  readonly isCurrentUser: boolean;
}

export interface FixtureLeaderboardProjection {
  readonly fixtureId: string;
  readonly status: FixtureLeaderboardStatus;
  readonly resultRevision: number | null;
  readonly totalEntries: number;
  readonly generatedFromScoreStatus: FixtureLeaderboardStatus;
  readonly currentUserParticipating: boolean;
  readonly rows: readonly FixtureLeaderboardRow[];
  readonly currentUserRow?: FixtureLeaderboardRow;
  readonly page: FixtureLeaderboardPage;
}

export interface FixtureLeaderboardPlayerIdentity {
  readonly userId: string;
  readonly rowId: string;
  readonly displayLabel: string;
}

export interface FixtureLeaderboardPredictionInput extends Pick<
  PredictionEntryDocument,
  'fixtureId' | 'prediction' | 'revision' | 'ruleset' | 'userId'
> {}

export type FixtureLeaderboardFixtureInput = Pick<
  FixtureDocument,
  '_id' | 'isCancelled' | 'rulesetSnapshot'
>;

export type FixtureLeaderboardResultInput = Pick<
  MatchResultDocument,
  'fixtureId' | 'observations' | 'revision' | 'ruleset'
>;

export interface FixtureLeaderboardPaginationInput {
  readonly offset: number;
  readonly limit: number;
}

export interface BuildFixtureLeaderboardInput {
  readonly fixture: FixtureLeaderboardFixtureInput;
  readonly result?: FixtureLeaderboardResultInput | null;
  readonly predictions: readonly FixtureLeaderboardPredictionInput[];
  readonly playerIdentities: readonly FixtureLeaderboardPlayerIdentity[];
  readonly currentUserId?: string | null;
  readonly page: FixtureLeaderboardPaginationInput;
}

export interface GetFixtureLeaderboardInput {
  readonly fixtureId: unknown;
  readonly offset?: unknown;
  readonly limit?: unknown;
}
