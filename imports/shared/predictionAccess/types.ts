export const predictionLockOverrideValues = ['locked', 'open'] as const;

export type PredictionLockOverride =
  (typeof predictionLockOverrideValues)[number];

export type PredictionAccessSource =
  'admin_locked' | 'admin_reopened' | 'automatic';

export type PredictionAccessReason =
  | 'admin_locked'
  | 'admin_reopened'
  | 'before_kickoff'
  | 'cancelled'
  | 'final'
  | 'kickoff_reached'
  | 'result_tracking_started';

export interface PredictionAccessResult {
  readonly isOpen: boolean;
  readonly reason: PredictionAccessReason;
  readonly source: PredictionAccessSource;
}

export interface PredictionAccessFixtureInput {
  readonly isCancelled: boolean;
  readonly predictionLockOverride?: PredictionLockOverride | null;
  readonly scheduledKickoffAt: Date;
}

export interface ResolvePredictionAccessInput {
  readonly fixture: PredictionAccessFixtureInput;
  readonly hasResultTrackingStarted: boolean;
  readonly isResultFinal?: boolean;
  readonly now: Date;
}

export type PredictionAccessAuditAction =
  'locked' | 'reopened' | 'reset-to-automatic';

export interface PredictionAccessAuditTestOwnership {
  readonly ownerRunId: string;
}

export interface PredictionAccessAuditDocument {
  readonly _id: string;
  readonly action: PredictionAccessAuditAction;
  readonly actorAdminUserId: string;
  readonly createdAt: Date;
  readonly fixtureId: string;
  readonly fixtureRevisionAfter: number;
  readonly fixtureRevisionBefore: number;
  readonly predictionLockOverrideAfter?: PredictionLockOverride;
  readonly predictionLockOverrideBefore?: PredictionLockOverride;
  readonly rugbyRoosterTest?: PredictionAccessAuditTestOwnership;
}
