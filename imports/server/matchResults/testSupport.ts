import { Meteor } from 'meteor/meteor';

import { MatchResults } from '/imports/api/matchResults/collection';
import { TEST_MATCH_RESULT_METHODS } from '/imports/shared/matchResults';
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

export const resetMatchResultTestData = async () => {
  const testEnvironment = await assertVerifiedAuthTestEnvironment();

  await MatchResults.removeAsync({
    'rugbyRoosterTest.ownerRunId': testEnvironment.runId,
  });
};

export const registerMatchResultTestMethods = async () => {
  if (!areTestHelpersEnabled()) {
    return;
  }

  await assertVerifiedAuthTestEnvironment();

  Meteor.methods({
    [TEST_MATCH_RESULT_METHODS.reset]: async function reset(
      ...args: unknown[]
    ) {
      assertArgCount(args, 0);
      await resetMatchResultTestData();

      return true;
    },
  });
};
