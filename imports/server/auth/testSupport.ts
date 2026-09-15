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
type VerifiedAuthTestEnvironment = Awaited<
  ReturnType<typeof assertVerifiedAuthTestEnvironment>
>;

interface AuthTestSupportDependencies {
  readonly areTestHelpersEnabled: typeof areTestHelpersEnabled;
  readonly assertVerifiedAuthTestEnvironment: () => Promise<VerifiedAuthTestEnvironment>;
  readonly failNextLocalMailForTests: typeof failNextLocalMailForTests;
  readonly grantPlatformAdminByEmail: typeof grantPlatformAdminByEmail;
  readonly latestCapturedMailFor: typeof latestCapturedMailFor;
  readonly registerMethods: typeof Meteor.methods;
  readonly resetAuthThrottlesForTests: typeof resetAuthThrottlesForTests;
  readonly resetLocalMailSinkForTests: typeof resetLocalMailSinkForTests;
  readonly revokePlatformAdminByEmail: typeof revokePlatformAdminByEmail;
  readonly users: Pick<
    typeof Meteor.users,
    'findOneAsync' | 'insertAsync' | 'removeAsync'
  >;
}

type AuthTestSupportDependencyOverrides = Partial<AuthTestSupportDependencies>;

const resolveAuthTestSupportDependencies = (
  overrides: AuthTestSupportDependencyOverrides = {},
): AuthTestSupportDependencies => ({
  areTestHelpersEnabled,
  assertVerifiedAuthTestEnvironment,
  failNextLocalMailForTests,
  grantPlatformAdminByEmail,
  latestCapturedMailFor,
  registerMethods: Meteor.methods.bind(Meteor),
  resetAuthThrottlesForTests,
  resetLocalMailSinkForTests,
  revokePlatformAdminByEmail,
  users: Meteor.users,
  ...overrides,
});

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
  users: AuthTestSupportDependencies['users'] = Meteor.users,
): Promise<Meteor.User | null> =>
  (await users.findOneAsync({
    'emails.address': email,
    'rugbyRoosterTest.ownerRunId': runId,
  })) ?? null;

const assertCurrentRunOwnsEmail = async (
  email: string,
  runId: string,
  users: AuthTestSupportDependencies['users'] = Meteor.users,
): Promise<void> => {
  const user = await findTestOwnedUserByEmail(email, runId, users);

  if (!user) {
    throw new Meteor.Error(
      'test-data-not-owned',
      'Test helper refused to operate on data outside the current test run.',
    );
  }
};

export const resetTestAuthData = async (
  overrides?: AuthTestSupportDependencyOverrides,
) => {
  const dependencies = resolveAuthTestSupportDependencies(overrides);
  const testEnvironment =
    await dependencies.assertVerifiedAuthTestEnvironment();

  await dependencies.users.removeAsync({
    'rugbyRoosterTest.ownerRunId': testEnvironment.runId,
  });
  dependencies.resetLocalMailSinkForTests(testEnvironment.runId);
  dependencies.resetAuthThrottlesForTests();
};

export const registerAuthTestMethods = async (
  overrides?: AuthTestSupportDependencyOverrides,
) => {
  const dependencies = resolveAuthTestSupportDependencies(overrides);

  if (!dependencies.areTestHelpersEnabled()) {
    return;
  }

  await dependencies.assertVerifiedAuthTestEnvironment();

  dependencies.registerMethods({
    [TEST_AUTH_METHODS.environment]: async function environment(
      ...args: unknown[]
    ) {
      assertArgCount(args, 0);
      const testEnvironment =
        await dependencies.assertVerifiedAuthTestEnvironment();

      return {
        appUrl: testEnvironment.appUrl,
        databaseId: testEnvironment.databaseId,
        databaseName: testEnvironment.databaseName,
        localDir: testEnvironment.localDir,
        mongoEndpoint: testEnvironment.mongoEndpoint,
        runId: testEnvironment.runId,
      };
    },

    [TEST_AUTH_METHODS.reset]: async function reset(...args: unknown[]) {
      assertArgCount(args, 0);
      await resetTestAuthData(dependencies);

      return true;
    },

    [TEST_AUTH_METHODS.latestMailFor]: async function latestMailFor(
      ...args: unknown[]
    ) {
      const [emailInput] = assertArgCount(args, 1);
      const testEnvironment =
        await dependencies.assertVerifiedAuthTestEnvironment();
      const email = assertTestEmail(emailInput);

      await assertCurrentRunOwnsEmail(
        email,
        testEnvironment.runId,
        dependencies.users,
      );

      const message = dependencies.latestCapturedMailFor(
        email,
        testEnvironment.runId,
      );

      if (!message) {
        return null;
      }

      return {
        createdAt: message.createdAt.toISOString(),
        from: message.from,
        html: message.html,
        id: message.id,
        replyTo: message.replyTo,
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
      const testEnvironment =
        await dependencies.assertVerifiedAuthTestEnvironment();
      const normalizedEmail = assertTestEmail(emailInput);

      const userId = await dependencies.users.insertAsync({
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
      const testEnvironment =
        await dependencies.assertVerifiedAuthTestEnvironment();
      const normalizedEmail = assertTestEmail(emailInput);
      const grant = assertBoolean(grantInput);

      await assertCurrentRunOwnsEmail(
        normalizedEmail,
        testEnvironment.runId,
        dependencies.users,
      );

      return grant
        ? dependencies.grantPlatformAdminByEmail(normalizedEmail)
        : dependencies.revokePlatformAdminByEmail(normalizedEmail);
    },

    'test.mail.failNext': async function failNextMail(...args: unknown[]) {
      assertArgCount(args, 0);
      await dependencies.assertVerifiedAuthTestEnvironment();
      dependencies.failNextLocalMailForTests();

      return true;
    },
  });
};
