import type { RulesetSnapshot } from '/imports/shared/scoring';
import type { FixturePredictionQuestionConfig } from '/imports/shared/predictionQuestions';

export const fixtureVisibilities = ['draft', 'published'] as const;
export const fixtureListModes = ['upcoming', 'past'] as const;

export type FixtureVisibility = (typeof fixtureVisibilities)[number];
export type FixtureListMode = (typeof fixtureListModes)[number];

export interface FixtureTestOwnership {
  readonly ownerRunId: string;
}

export interface FixtureDocument {
  readonly _id: string;
  readonly team1DisplayName: string;
  readonly team2DisplayName: string;
  readonly competitionDisplayName: string;
  readonly scheduledKickoffAt: Date;
  readonly venueDisplayName?: string;
  readonly visibility: FixtureVisibility;
  readonly isCancelled: boolean;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByAdminId: string;
  readonly updatedByAdminId: string;
  readonly publishedAt?: Date;
  readonly publishedByAdminId?: string;
  readonly cancelledAt?: Date;
  readonly cancelledByAdminId?: string;
  readonly rulesetSnapshot?: RulesetSnapshot;
  readonly predictionQuestionConfig?: FixturePredictionQuestionConfig;
  readonly rugbyRoosterTest?: FixtureTestOwnership;
}

export interface FixtureDetailsInput {
  readonly competitionDisplayName: unknown;
  readonly scheduledKickoffAt: unknown;
  readonly team1DisplayName: unknown;
  readonly team2DisplayName: unknown;
  readonly venueDisplayName?: unknown;
}

export interface SanitizedFixtureDetails {
  readonly competitionDisplayName: string;
  readonly scheduledKickoffAt: Date;
  readonly team1DisplayName: string;
  readonly team2DisplayName: string;
  readonly venueDisplayName?: string;
}

export interface CreateFixtureDraftInput {
  readonly details: FixtureDetailsInput;
}

export interface EditFixtureDetailsInput {
  readonly details: FixtureDetailsInput;
  readonly expectedRevision: unknown;
  readonly fixtureId: unknown;
}

export interface PublishFixtureInput {
  readonly expectedRevision: unknown;
  readonly fixtureId: unknown;
}

export interface CancelFixtureInput {
  readonly expectedRevision: unknown;
  readonly fixtureId: unknown;
}

export interface FixtureMutationResult {
  readonly fixtureId: string;
  readonly status:
    | 'already-cancelled'
    | 'already-published'
    | 'cancelled'
    | 'created'
    | 'updated'
    | 'published';
}

export interface FixtureListOptions {
  readonly boundary?: unknown;
  readonly cursor?: unknown;
  readonly limit?: unknown;
  readonly mode?: unknown;
}

export interface FixtureListCursorInput {
  readonly fixtureId: unknown;
  readonly scheduledKickoffAt: unknown;
}

export interface FixtureListCursor {
  readonly fixtureId: string;
  readonly scheduledKickoffAt: Date;
}
