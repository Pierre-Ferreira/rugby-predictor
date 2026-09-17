import type {
  FixtureObservations,
  RulesetIdentity,
} from '/imports/shared/scoring';

export const NO_MATCH_RESULT_REVISION = 0;
export const INITIAL_MATCH_RESULT_REVISION = 1;
export const MAX_MATCH_RESULT_SUMMARY_FIXTURES = 100;

export type MatchResultAdminState = 'none' | 'provisional' | 'final';

export interface MatchResultTestOwnership {
  readonly ownerRunId: string;
}

export interface MatchResultDocument {
  readonly _id: string;
  readonly fixtureId: string;
  readonly ruleset: RulesetIdentity;
  readonly observations: FixtureObservations;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByAdminId: string;
  readonly updatedByAdminId: string;
  readonly confirmedAt?: Date;
  readonly confirmedByAdminId?: string;
  readonly rugbyRoosterTest?: MatchResultTestOwnership;
}

export interface MatchResultMutationResult {
  readonly fixtureId: string;
  readonly resultId: string;
  readonly revision: number;
  readonly status: 'created' | 'updated' | 'confirmed';
}

export interface MatchResultMutationInput {
  readonly expectedRevision: unknown;
  readonly fixtureId: unknown;
  readonly observations: unknown;
}
