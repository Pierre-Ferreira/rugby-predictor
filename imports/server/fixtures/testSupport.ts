import { Meteor } from 'meteor/meteor';

import { Fixtures } from '/imports/api/fixtures/collection';
import {
  INITIAL_FIXTURE_REVISION,
  TEST_FIXTURE_METHODS,
  sanitizeCreateDraftInput,
  type FixtureDocument,
} from '/imports/shared/fixtures';
import {
  areTestHelpersEnabled,
  assertVerifiedAuthTestEnvironment,
} from '/imports/server/auth/settings';
import { createDefaultFixtureRulesetSnapshot } from './ruleset';

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

export const resetFixtureTestData = async () => {
  const testEnvironment = await assertVerifiedAuthTestEnvironment();

  await Fixtures.removeAsync({
    'rugbyRoosterTest.ownerRunId': testEnvironment.runId,
  });
};

export const registerFixtureTestMethods = async () => {
  if (!areTestHelpersEnabled()) {
    return;
  }

  await assertVerifiedAuthTestEnvironment();

  Meteor.methods({
    [TEST_FIXTURE_METHODS.reset]: async function reset(...args: unknown[]) {
      assertArgCount(args, 0);
      await resetFixtureTestData();

      return true;
    },

    [TEST_FIXTURE_METHODS.createPublished]: async function createPublished(
      ...args: unknown[]
    ) {
      const [input] = assertArgCount(args, 1);
      const testEnvironment = await assertVerifiedAuthTestEnvironment();
      const details = sanitizeCreateDraftInput(input);
      const now = new Date();
      const actorId = `test-fixture-admin-${testEnvironment.runId}`;
      const fixtureId = await Fixtures.insertAsync({
        ...details,
        createdAt: now,
        createdByAdminId: actorId,
        isCancelled: false,
        publishedAt: now,
        publishedByAdminId: actorId,
        revision: INITIAL_FIXTURE_REVISION,
        rugbyRoosterTest: {
          ownerRunId: testEnvironment.runId,
        },
        rulesetSnapshot: createDefaultFixtureRulesetSnapshot(),
        updatedAt: now,
        updatedByAdminId: actorId,
        visibility: 'published',
      } as FixtureDocument);

      return {
        fixtureId,
      };
    },
  });
};
