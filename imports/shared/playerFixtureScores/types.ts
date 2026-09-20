import type { FixtureDocument } from '/imports/shared/fixtures';
import type { MatchResultDocument } from '/imports/shared/matchResults';
import type { PredictionEntryDocument } from '/imports/shared/predictions';
import type {
  FixtureScoreResult,
  QuestionScoreBreakdown,
  RulesetResultReference,
  STARTING_POINTS,
} from '/imports/shared/scoring';

export type PlayerFixtureScoreStatus =
  'awaiting_result' | 'provisional' | 'final' | 'cancelled';

export type PlayerFixtureScoreComponentStatus = 'resolved' | 'pending' | 'void';

export interface PlayerFixtureScoreComponent {
  readonly key: string;
  readonly questionId: string;
  readonly label: string;
  readonly type: QuestionScoreBreakdown['type'];
  readonly status: PlayerFixtureScoreComponentStatus;
  readonly deduction: number | null;
  readonly items: QuestionScoreBreakdown['items'];
}

export interface PlayerFixtureScoreProjection {
  readonly fixtureId: string;
  readonly predictionRevision: number;
  readonly resultRevision: number | null;
  readonly status: PlayerFixtureScoreStatus;
  readonly startingPoints: typeof STARTING_POINTS;
  readonly currentScore: FixtureScoreResult['score'] | null;
  readonly finalScore: FixtureScoreResult['score'] | null;
  readonly resolvedDeduction: FixtureScoreResult['totalDeductions'];
  readonly pendingCount: number;
  readonly ruleset: RulesetResultReference;
  readonly components: readonly PlayerFixtureScoreComponent[];
}

export type PlayerFixtureScoreFixtureInput = Pick<
  FixtureDocument,
  '_id' | 'isCancelled' | 'rulesetSnapshot'
>;

export type PlayerFixtureScorePredictionInput = Pick<
  PredictionEntryDocument,
  'fixtureId' | 'prediction' | 'revision' | 'ruleset'
>;

export type PlayerFixtureScoreResultInput = Pick<
  MatchResultDocument,
  'fixtureId' | 'observations' | 'revision' | 'ruleset'
>;

export interface CalculatePlayerFixtureScoreProjectionInput {
  readonly fixture: PlayerFixtureScoreFixtureInput;
  readonly prediction: PlayerFixtureScorePredictionInput;
  readonly result?: PlayerFixtureScoreResultInput | null;
}
