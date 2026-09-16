import { Meteor } from 'meteor/meteor';

import { Fixtures } from '/imports/api/fixtures/collection';
import {
  INITIAL_FIXTURE_REVISION,
  TEST_FIXTURE_METHODS,
  sanitizeCreateDraftInput,
  type FixtureDocument,
} from '/imports/shared/fixtures';
import {
  builtInQuestionIds,
  type BuiltInQuestionId,
  type RulesetSnapshot,
} from '/imports/shared/scoring';
import {
  areTestHelpersEnabled,
  assertVerifiedAuthTestEnvironment,
} from '/imports/server/auth/settings';
import { createDefaultFixtureRulesetSnapshot } from './ruleset';

const builtInQuestionIdSet = new Set<string>(builtInQuestionIds);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

const sanitizeDisabledBuiltInQuestionIds = (
  value: unknown,
): readonly BuiltInQuestionId[] => {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Meteor.Error(
      'invalid-test-fixture-ruleset',
      'Disabled built-in question ids must be an array.',
    );
  }

  return value.map((candidate) => {
    if (typeof candidate !== 'string' || !builtInQuestionIdSet.has(candidate)) {
      throw new Meteor.Error(
        'invalid-test-fixture-ruleset',
        'Disabled built-in question id is not supported.',
      );
    }

    return candidate as BuiltInQuestionId;
  });
};

const sanitizeCreatePublishedTestInput = (input: unknown) => {
  if (!isRecord(input)) {
    throw new Meteor.Error(
      'invalid-test-helper-call',
      'Published fixture test input is required.',
    );
  }

  const allowedKeys = new Set(['details', 'disabledBuiltInQuestionIds']);
  const unknownKeys = Object.keys(input).filter((key) => !allowedKeys.has(key));

  if (unknownKeys.length > 0) {
    throw new Meteor.Error(
      'invalid-test-helper-call',
      `Published fixture test input contains unsupported fields: ${unknownKeys.join(
        ', ',
      )}.`,
    );
  }

  return {
    details: sanitizeCreateDraftInput({ details: input.details }),
    disabledBuiltInQuestionIds: sanitizeDisabledBuiltInQuestionIds(
      input.disabledBuiltInQuestionIds,
    ),
  };
};

const disableBuiltInQuestions = (
  ruleset: RulesetSnapshot,
  disabledIds: readonly BuiltInQuestionId[],
): RulesetSnapshot => {
  if (disabledIds.length === 0) {
    return ruleset;
  }

  const disabled = new Set<string>(disabledIds);

  return {
    ...ruleset,
    questions: ruleset.questions.map((question) =>
      disabled.has(question.id) ? { ...question, enabled: false } : question,
    ),
  };
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
      const { details, disabledBuiltInQuestionIds } =
        sanitizeCreatePublishedTestInput(input);
      const rulesetSnapshot = disableBuiltInQuestions(
        createDefaultFixtureRulesetSnapshot(),
        disabledBuiltInQuestionIds,
      );
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
        rulesetSnapshot,
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
