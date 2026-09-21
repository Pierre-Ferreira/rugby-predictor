import { Meteor } from 'meteor/meteor';

import { PlayerProfiles } from '/imports/api/playerProfiles/collection';
import { TEST_PLAYER_PROFILE_METHODS } from '/imports/shared/playerProfiles';
import {
  areTestHelpersEnabled,
  assertVerifiedAuthTestEnvironment,
} from '/imports/server/auth/settings';

export const resetPlayerProfileTestData = async () => {
  const testEnvironment = await assertVerifiedAuthTestEnvironment();

  await PlayerProfiles.removeAsync({
    'rugbyRoosterTest.ownerRunId': testEnvironment.runId,
  });
};

export const registerPlayerProfileTestMethods = async () => {
  if (!areTestHelpersEnabled()) {
    return;
  }

  await assertVerifiedAuthTestEnvironment();

  Meteor.methods({
    [TEST_PLAYER_PROFILE_METHODS.reset]: async function reset(
      ...args: unknown[]
    ) {
      if (args.length !== 0) {
        throw new Meteor.Error(
          'invalid-test-helper-call',
          'Test helper call has invalid arguments.',
        );
      }

      await resetPlayerProfileTestData();

      return true;
    },
  });
};
