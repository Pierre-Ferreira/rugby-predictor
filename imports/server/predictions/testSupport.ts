import { Meteor } from 'meteor/meteor';

import { Predictions } from '/imports/api/predictions/collection';
import { TEST_PREDICTION_METHODS } from '/imports/shared/predictions';
import {
  areTestHelpersEnabled,
  assertVerifiedAuthTestEnvironment,
} from '/imports/server/auth/settings';

const assertArgCount = (
  args: readonly unknown[],
  expected: number,
): readonly unknown[] => {
  if (args.length !== expected) {
    throw new Meteor.Error(
      'invalid-test-helper-call',
      'Test helper call has invalid arguments.',
    );
  }

  return args;
};

export const resetPredictionTestData = async () => {
  const testEnvironment = await assertVerifiedAuthTestEnvironment();

  await Predictions.removeAsync({
    'rugbyRoosterTest.ownerRunId': testEnvironment.runId,
  });
};

export const registerPredictionTestMethods = async () => {
  if (!areTestHelpersEnabled()) {
    return;
  }

  await assertVerifiedAuthTestEnvironment();

  Meteor.methods({
    [TEST_PREDICTION_METHODS.reset]: async function reset(...args: unknown[]) {
      assertArgCount(args, 0);
      await resetPredictionTestData();

      return true;
    },
  });
};
