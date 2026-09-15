import type { RulesetSnapshot } from '/imports/shared/scoring';

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
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByAdminId: string;
  readonly updatedByAdminId: string;
  readonly publishedAt?: Date;
  readonly publishedByAdminId?: string;
  readonly cancelledAt?: Date;
  readonly cancelledByAdminId?: string;
  readonly rulesetSnapshot?: RulesetSnapshot;
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
  readonly expectedUpdatedAt: unknown;
  readonly fixtureId: unknown;
}

export interface PublishFixtureInput {
  readonly expectedUpdatedAt: unknown;
  readonly fixtureId: unknown;
}

export interface CancelFixtureInput {
  readonly expectedUpdatedAt: unknown;
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
  readonly limit?: unknown;
  readonly mode?: unknown;
}
