import { Meteor } from 'meteor/meteor';

import { TEST_AUTH_METHODS } from '/imports/shared/auth/methods';
import { validateEmailIdentity } from '/imports/shared/auth/email';
import {
  failNextLocalMailForTests,
  latestCapturedMailFor,
  resetLocalMailSinkForTests,
} from './mailSink';
import { resetAuthThrottlesForTests } from './throttle';
import {
  areTestHelpersEnabled,
  assertVerifiedAuthTestEnvironment,
} from './settings';
import {
  grantPlatformAdminByEmail,
  revokePlatformAdminByEmail,
} from './authorization';

const TEST_EMAIL_PATTERN = /@example\.test$/;

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

const assertTestEmail = (value: unknown): string => {
  const validation = validateEmailIdentity(value);

  if (!validation.isValid || !TEST_EMAIL_PATTERN.test(validation.email)) {
    throw new Meteor.Error(
      'invalid-test-email',
      'Test helpers only operate on example.test accounts.',
    );
  }

  return validation.email;
};

const assertBoolean = (value: unknown): boolean => {
  if (typeof value !== 'boolean') {
    throw new Meteor.Error(
      'invalid-test-helper-call',
      'Test helper call has invalid arguments.',
    );
  }

  return value;
};

const findTestOwnedUserByEmail = async (
  email: string,
  runId: string,
): Promise<Meteor.User | null> =>
  (await Meteor.users.findOneAsync({
    'emails.address': email,
    'rugbyRoosterTest.ownerRunId': runId,
  })) ?? null;

const assertCurrentRunOwnsEmail = async (
  email: string,
  runId: string,
): Promise<void> => {
  const user = await findTestOwnedUserByEmail(email, runId);

  if (!user) {
    throw new Meteor.Error(
      'test-data-not-owned',
      'Test helper refused to operate on data outside the current test run.',
    );
  }
};

export const resetTestAuthData = async () => {
  const testEnvironment = assertVerifiedAuthTestEnvironment();

  await Meteor.users.removeAsync({
    'rugbyRoosterTest.ownerRunId': testEnvironment.runId,
  });
  resetLocalMailSinkForTests(testEnvironment.runId);
  resetAuthThrottlesForTests();
};

export const registerAuthTestMethods = () => {
  if (!areTestHelpersEnabled()) {
    return;
  }

  Meteor.methods({
    [TEST_AUTH_METHODS.environment]: function environment(...args: unknown[]) {
      assertArgCount(args, 0);
      const testEnvironment = assertVerifiedAuthTestEnvironment();

      return {
        appUrl: testEnvironment.appUrl,
        databaseId: testEnvironment.databaseId,
        databaseName: testEnvironment.databaseName,
        localDir: testEnvironment.localDir,
        runId: testEnvironment.runId,
      };
    },

    [TEST_AUTH_METHODS.reset]: async function reset(...args: unknown[]) {
      assertArgCount(args, 0);
      await resetTestAuthData();

      return true;
    },

    [TEST_AUTH_METHODS.latestMailFor]: async function latestMailFor(
      ...args: unknown[]
    ) {
      const [emailInput] = assertArgCount(args, 1);
      const testEnvironment = assertVerifiedAuthTestEnvironment();
      const email = assertTestEmail(emailInput);

      await assertCurrentRunOwnsEmail(email, testEnvironment.runId);

      const message = latestCapturedMailFor(email, testEnvironment.runId);

      if (!message) {
        return null;
      }

      return {
        createdAt: message.createdAt.toISOString(),
        html: message.html,
        id: message.id,
        subject: message.subject,
        text: message.text,
        to: message.to,
        url: message.url,
      };
    },

    [TEST_AUTH_METHODS.createVerifiedUser]: async function createVerifiedUser(
      ...args: unknown[]
    ) {
      const [emailInput] = assertArgCount(args, 1);
      const testEnvironment = assertVerifiedAuthTestEnvironment();
      const normalizedEmail = assertTestEmail(emailInput);

      const userId = await Meteor.users.insertAsync({
        createdAt: new Date(),
        emails: [
          {
            address: normalizedEmail,
            verified: true,
          },
        ],
        rugbyRoosterTest: {
          ownerRunId: testEnvironment.runId,
        },
        services: {},
      } as unknown as Meteor.User);

      return {
        email: normalizedEmail,
        userId,
      };
    },

    [TEST_AUTH_METHODS.setAdminForEmail]: async function setAdminForEmail(
      ...args: unknown[]
    ) {
      const [emailInput, grantInput] = assertArgCount(args, 2);
      const testEnvironment = assertVerifiedAuthTestEnvironment();
      const normalizedEmail = assertTestEmail(emailInput);
      const grant = assertBoolean(grantInput);

      await assertCurrentRunOwnsEmail(normalizedEmail, testEnvironment.runId);

      return grant
        ? grantPlatformAdminByEmail(normalizedEmail)
        : revokePlatformAdminByEmail(normalizedEmail);
    },

    'test.mail.failNext': function failNextMail(...args: unknown[]) {
      assertArgCount(args, 0);
      assertVerifiedAuthTestEnvironment();
      failNextLocalMailForTests();

      return true;
    },
  });
};
