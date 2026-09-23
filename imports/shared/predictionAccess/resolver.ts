import type {
  PredictionAccessReason,
  PredictionAccessResult,
  ResolvePredictionAccessInput,
} from './types';

export const PREDICTION_ACCESS_LOCKED_ERROR = 'prediction-access-locked';

export const resolvePredictionAccess = ({
  fixture,
  hasResultTrackingStarted,
  isResultFinal = false,
  now,
}: ResolvePredictionAccessInput): PredictionAccessResult => {
  if (fixture.isCancelled) {
    return {
      isOpen: false,
      reason: 'cancelled',
      source: 'automatic',
    };
  }

  if (isResultFinal) {
    return {
      isOpen: false,
      reason: 'final',
      source: 'automatic',
    };
  }

  if (fixture.predictionLockOverride === 'open') {
    return {
      isOpen: true,
      reason: 'admin_reopened',
      source: 'admin_reopened',
    };
  }

  if (fixture.predictionLockOverride === 'locked') {
    return {
      isOpen: false,
      reason: 'admin_locked',
      source: 'admin_locked',
    };
  }

  if (hasResultTrackingStarted) {
    return {
      isOpen: false,
      reason: 'result_tracking_started',
      source: 'automatic',
    };
  }

  if (now.getTime() >= fixture.scheduledKickoffAt.getTime()) {
    return {
      isOpen: false,
      reason: 'kickoff_reached',
      source: 'automatic',
    };
  }

  return {
    isOpen: true,
    reason: 'before_kickoff',
    source: 'automatic',
  };
};

export const predictionAccessReasonLabel = (
  reason: PredictionAccessReason,
): string => {
  switch (reason) {
    case 'admin_locked':
      return 'Locked by admin';
    case 'admin_reopened':
      return 'Reopened by admin';
    case 'before_kickoff':
      return 'Automatic: before kickoff';
    case 'cancelled':
      return 'Automatic: cancelled';
    case 'final':
      return 'Automatic: final result confirmed';
    case 'kickoff_reached':
      return 'Automatic: kickoff reached';
    case 'result_tracking_started':
      return 'Automatic: result tracking started';
  }
};

export const predictionAccessStateLabel = (
  access: PredictionAccessResult,
): 'LOCKED' | 'OPEN' => (access.isOpen ? 'OPEN' : 'LOCKED');

export const predictionAccessPlayerLockedReason = (
  reason: PredictionAccessReason,
): string => {
  switch (reason) {
    case 'admin_locked':
      return 'Predictions were locked by the game administrator.';
    case 'cancelled':
      return 'This fixture has been cancelled.';
    case 'final':
      return 'The final result has been confirmed.';
    case 'kickoff_reached':
      return 'Kickoff has passed.';
    case 'result_tracking_started':
      return 'Result tracking has started.';
    case 'admin_reopened':
    case 'before_kickoff':
      return 'Predictions are locked for this fixture.';
  }
};
