import type {
  FixturePrediction,
  RulesetIdentity,
} from '/imports/shared/scoring';

export interface PredictionTestOwnership {
  readonly ownerRunId: string;
}

export interface PredictionEntryDocument {
  readonly _id: string;
  readonly fixtureId: string;
  readonly userId: string;
  readonly prediction: FixturePrediction;
  readonly ruleset: RulesetIdentity;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly rugbyRoosterTest?: PredictionTestOwnership;
}

export interface SubmitPredictionInput {
  readonly expectedRevision?: unknown;
  readonly fixtureId: unknown;
  readonly prediction: unknown;
}

export interface SanitizedSubmitPredictionInput {
  readonly expectedRevision?: number;
  readonly fixtureId: string;
  readonly prediction: FixturePrediction;
}

export interface PredictionMutationResult {
  readonly fixtureId: string;
  readonly predictionId: string;
  readonly revision: number;
  readonly status: 'created' | 'updated';
}
