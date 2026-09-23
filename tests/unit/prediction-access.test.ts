import { describe, expect, it } from 'vitest';

import {
  resolvePredictionAccess,
  type PredictionAccessFixtureInput,
} from '../../imports/shared/predictionAccess';

const kickoff = new Date('2030-01-01T12:00:00.000Z');

const fixture = (
  overrides: Partial<PredictionAccessFixtureInput> = {},
): PredictionAccessFixtureInput => ({
  isCancelled: false,
  scheduledKickoffAt: kickoff,
  ...overrides,
});

const access = (input: {
  readonly fixture?: PredictionAccessFixtureInput;
  readonly hasResultTrackingStarted?: boolean;
  readonly isResultFinal?: boolean;
  readonly now: string;
}) =>
  resolvePredictionAccess({
    fixture: input.fixture ?? fixture(),
    hasResultTrackingStarted: input.hasResultTrackingStarted ?? false,
    isResultFinal: input.isResultFinal ?? false,
    now: new Date(input.now),
  });

describe('prediction access resolver', () => {
  it('keeps automatic access open before kickoff and locked at or after kickoff', () => {
    expect(access({ now: '2030-01-01T11:59:59.999Z' })).toEqual({
      isOpen: true,
      reason: 'before_kickoff',
      source: 'automatic',
    });
    expect(access({ now: '2030-01-01T12:00:00.000Z' })).toEqual({
      isOpen: false,
      reason: 'kickoff_reached',
      source: 'automatic',
    });
    expect(access({ now: '2030-01-01T12:00:00.001Z' })).toEqual({
      isOpen: false,
      reason: 'kickoff_reached',
      source: 'automatic',
    });
  });

  it('locks automatic access once result tracking starts before kickoff', () => {
    expect(
      access({
        hasResultTrackingStarted: true,
        now: '2030-01-01T11:00:00.000Z',
      }),
    ).toEqual({
      isOpen: false,
      reason: 'result_tracking_started',
      source: 'automatic',
    });
  });

  it('honors explicit admin lock and admin reopen overrides', () => {
    expect(
      access({
        fixture: fixture({ predictionLockOverride: 'locked' }),
        now: '2030-01-01T11:00:00.000Z',
      }),
    ).toEqual({
      isOpen: false,
      reason: 'admin_locked',
      source: 'admin_locked',
    });
    expect(
      access({
        fixture: fixture({ predictionLockOverride: 'open' }),
        hasResultTrackingStarted: true,
        now: '2030-01-01T12:00:00.001Z',
      }),
    ).toEqual({
      isOpen: true,
      reason: 'admin_reopened',
      source: 'admin_reopened',
    });
  });

  it('keeps final and cancelled fixtures locked even when override is open', () => {
    expect(
      access({
        fixture: fixture({ predictionLockOverride: 'open' }),
        isResultFinal: true,
        now: '2030-01-01T11:00:00.000Z',
      }),
    ).toEqual({
      isOpen: false,
      reason: 'final',
      source: 'automatic',
    });
    expect(
      access({
        fixture: fixture({
          isCancelled: true,
          predictionLockOverride: 'open',
        }),
        now: '2030-01-01T11:00:00.000Z',
      }),
    ).toEqual({
      isOpen: false,
      reason: 'cancelled',
      source: 'automatic',
    });
  });
});
