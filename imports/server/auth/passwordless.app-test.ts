import assert from 'node:assert/strict';
import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import {
  PASSWORDLESS_LINK_EXPIRY_MINUTES,
  SESSION_EXPIRY_DAYS,
} from '/imports/shared/auth/constants';
import {
  ADMIN_METHODS,
  AUTH_METHODS,
  type CurrentAccessResult,
  TEST_AUTH_METHODS,
} from '/imports/shared/auth/methods';
import { resolveSafeReturnPath } from '/imports/shared/auth/redirects';
import { assertIsolatedMongoConnectionIdentity } from '/imports/shared/auth/testDatabaseIdentity';
import { failNextLocalMailForTests, latestCapturedMailFor } from './mailSink';
import { registerAuthTestMethods, resetTestAuthData } from './testSupport';
import {
  AUTH_THROTTLE_LIMITS,
  checkAuthThrottle,
  getAuthThrottleBucketCountForTests,
  resetAuthThrottlesForTests,
} from './throttle';
import {
  grantPlatformAdminByEmail,
  revokePlatformAdminByEmail,
} from './authorization';
import {
  getActiveMongoConnectionIdentity,
  getActiveMongoConnectionTopologyDiagnostic,
} from './mongoConnectionIdentity';

type MethodHandler = (
  this: Meteor.MethodThisType,
  ...args: unknown[]
) => Promise<unknown>;

interface LoginResult {
  readonly id: string;
  readonly token: string;
  readonly tokenExpires: Date;
}

interface TestInvocation extends Meteor.MethodThisType {
  userId: string | null;
}

const handlers = (): Record<string, MethodHandler> =>
  (
    Meteor as unknown as {
      server: {
        method_handlers: Record<string, MethodHandler>;
      };
    }
  ).server.method_handlers;

const makeInvocation = (
  label = Random.id(),
  clientAddress = '127.0.0.1',
): TestInvocation => {
  const invocation: {
    connection: {
      clientAddress: string;
      close: () => undefined;
      id: string;
    };
    isSimulation: false;
    setUserId: (userId: string | null) => Promise<void>;
    unblock: () => undefined;
    userId: string | null;
  } = {
    connection: {
      clientAddress,
      close: () => undefined,
      id: `test-${label}`,
    },
    isSimulation: false,
    setUserId(userId: string | null) {
      invocation.userId = userId;
      return Promise.resolve();
    },
    unblock: () => undefined,
    userId: null,
  };

  return invocation as unknown as TestInvocation;
};

const callMethod = async <TResult>(
  name: string,
  args: readonly unknown[] = [],
  invocation = makeInvocation(),
): Promise<TResult> => {
  const handler = handlers()[name];

  assert.equal(typeof handler, 'function', `${name} method exists`);

  return (await handler.apply(invocation, [...args])) as TResult;
};

const uniqueEmail = (prefix: string): string =>
  `ccpp004-${prefix}-${Random.id().toLowerCase()}@example.test`;

const fakeVerifiedTestEnvironment = () => ({
  appUrl: 'http://127.0.0.1:3400',
  databaseId: 'meteor-managed:.meteor/local-integration:db',
  databaseName: 'meteor',
  localDir: '.meteor/local-integration',
  mongoEndpoint: {
    host: '127.0.0.1',
    port: 3401,
  },
  runId: `rr-integration-${Random.id()}`,
});

const requestLink = async (
  email: string,
  returnTo = '/account',
  invocation = makeInvocation(),
) =>
  callMethod(AUTH_METHODS.requestSignInLink, [{ email, returnTo }], invocation);

const requestAdminLink = async (email: string, invocation = makeInvocation()) =>
  callMethod(AUTH_METHODS.requestAdminSignInLink, [{ email }], invocation);

const directPackageRequest = async (
  payload: unknown,
  invocation = makeInvocation(),
) => callMethod('requestLoginTokenForUser', [payload], invocation);

const getLinkParts = (email: string) => {
  const mail = latestCapturedMailFor(email);
  assert.ok(mail?.url, 'captured passwordless email link exists');

  const url = new URL(mail.url);
  const linkEmail = url.searchParams.get('email');
  const token = url.searchParams.get('token');
  const returnTo = url.searchParams.get('returnTo');

  assert.ok(linkEmail, 'link includes email');
  assert.ok(token, 'link includes token');

  return {
    email: linkEmail,
    returnTo,
    token,
    url,
  };
};

const loginWithLink = async (
  email: string,
  token: string,
  invocation = makeInvocation(),
) =>
  callMethod<LoginResult>(
    'login',
    [
      {
        selector: { email },
        token,
      },
    ],
    invocation,
  );

const findUserByEmail = async (email: string, fields = {}) => {
  const findUser = Accounts.findUserByEmail as unknown as (
    emailAddress: string,
    options: unknown,
  ) => Promise<Meteor.User | null>;

  return (
    (await findUser(email, {
      fields,
    })) ?? null
  );
};

const getPasswordlessStateForEmail = async (email: string) => {
  const user = (await findUserByEmail(email, {
    services: 1,
  })) as { readonly services?: { readonly passwordless?: unknown } } | null;

  return JSON.parse(
    JSON.stringify(user?.services?.passwordless ?? null),
  ) as unknown;
};

if (
  process.env.RUGBY_ROOSTER_TEST_MONGO_DIAGNOSTICS === '1' &&
  process.env.RUGBY_ROOSTER_TEST_MODE === 'isolated'
) {
  describe('CCPP-004 MongoDB topology diagnostic', function (this: Mocha.Suite) {
    this.timeout(20_000);

    it('reports sanitized MongoDB topology metadata', async () => {
      const diagnostic = await getActiveMongoConnectionTopologyDiagnostic();

      console.info(
        `[rugby-rooster:test-mongo-topology:test] ${JSON.stringify(
          diagnostic,
        )}`,
      );
      assert.ok(diagnostic, 'sanitized MongoDB topology metadata exists');
    });
  });
}

describe('CCPP-004 auth test helper database gating', function (this: Mocha.Suite) {
  this.timeout(20_000);

  it('does not register helper methods when database verification fails', async () => {
    let registerCalled = false;

    await assert.rejects(
      () =>
        registerAuthTestMethods({
          areTestHelpersEnabled: () => true,
          assertVerifiedAuthTestEnvironment: async () => {
            throw new Meteor.Error(
              'test-environment-mismatch',
              'simulated database mismatch before registration',
            );
          },
          registerMethods: () => {
            registerCalled = true;
          },
        }),
      /simulated database mismatch before registration/,
    );

    assert.equal(registerCalled, false);
  });

  it('checks database verification before helper mutations', async () => {
    const registered: Record<string, MethodHandler> = {};
    let insertCalled = false;
    let verificationCalls = 0;

    await registerAuthTestMethods({
      areTestHelpersEnabled: () => true,
      assertVerifiedAuthTestEnvironment: async () => {
        verificationCalls += 1;

        if (verificationCalls === 1) {
          return fakeVerifiedTestEnvironment();
        }

        throw new Meteor.Error(
          'test-environment-mismatch',
          'simulated database mismatch before helper mutation',
        );
      },
      registerMethods: (methods) => {
        Object.assign(registered, methods);
      },
      users: {
        findOneAsync: async () => undefined,
        insertAsync: async () => {
          insertCalled = true;
          return 'unexpected-user-id';
        },
        removeAsync: async () => 0,
      } as unknown as Pick<
        typeof Meteor.users,
        'findOneAsync' | 'insertAsync' | 'removeAsync'
      >,
    });

    const createVerifiedUser = registered[TEST_AUTH_METHODS.createVerifiedUser];

    assert.equal(typeof createVerifiedUser, 'function');
    await assert.rejects(
      () =>
        createVerifiedUser.apply(makeInvocation('blocked-helper-mutation'), [
          uniqueEmail('blocked-helper-mutation'),
        ]),
      /simulated database mismatch before helper mutation/,
    );

    assert.equal(verificationCalls, 2);
    assert.equal(insertCalled, false);
  });
});

describe('CCPP-004 passwordless accounts and authorisation', function (this: Mocha.Suite) {
  this.timeout(20_000);

  beforeEach(async () => {
    await resetTestAuthData();
  });

  it('proves the isolated test environment before helpers run', async () => {
    const environment = await callMethod<{
      readonly appUrl: string;
      readonly databaseId: string;
      readonly databaseName: string;
      readonly localDir: string;
      readonly mongoEndpoint: {
        readonly host: string;
        readonly port: number;
      };
      readonly runId: string;
    }>(TEST_AUTH_METHODS.environment);
    const observedIdentity = await getActiveMongoConnectionIdentity();
    const expectedMongoPort = Number(new URL(environment.appUrl).port) + 1;

    assert.match(environment.appUrl, /^http:\/\/127\.0\.0\.1:/);
    assert.match(environment.databaseId, /^meteor-managed:/);
    assert.equal(environment.databaseName, 'meteor');
    assert.match(environment.localDir, /\.meteor\/local-integration$/);
    assert.equal(environment.mongoEndpoint.host, '127.0.0.1');
    assert.equal(environment.mongoEndpoint.port, expectedMongoPort);
    assert.match(environment.runId, /^rr-integration-/);
    assertIsolatedMongoConnectionIdentity({
      expected: {
        databaseName: environment.databaseName,
        endpoint: environment.mongoEndpoint,
      },
      observed: observedIdentity,
    });
    assert.equal(observedIdentity?.databaseName, environment.databaseName);
    assert.ok(
      observedIdentity?.endpoints?.some(
        (endpoint) =>
          endpoint.host === environment.mongoEndpoint.host &&
          endpoint.port === environment.mongoEndpoint.port,
      ),
      'active MongoDB identity includes the expected endpoint',
    );
  });

  it('limits helper cleanup and mutations to current-run owned data', async () => {
    const environment = await callMethod<{ readonly runId: string }>(
      TEST_AUTH_METHODS.environment,
    );
    const ownedEmail = uniqueEmail('owned-helper');
    const otherRunEmail = uniqueEmail('other-run');
    const unownedEmail = uniqueEmail('unowned');

    await callMethod(TEST_AUTH_METHODS.createVerifiedUser, [ownedEmail]);

    await Meteor.users.insertAsync({
      createdAt: new Date(),
      emails: [
        {
          address: otherRunEmail,
          verified: true,
        },
      ],
      rugbyRoosterTest: {
        ownerRunId: 'rr-integration-other-run',
      },
      services: {},
    } as unknown as Meteor.User);
    await Meteor.users.insertAsync({
      createdAt: new Date(),
      emails: [
        {
          address: unownedEmail,
          verified: true,
        },
      ],
      services: {},
    });

    assert.equal(
      await callMethod(TEST_AUTH_METHODS.setAdminForEmail, [ownedEmail, true]),
      true,
    );
    await assert.rejects(
      () =>
        callMethod(TEST_AUTH_METHODS.setAdminForEmail, [otherRunEmail, true]),
      /outside the current test run/i,
    );
    await assert.rejects(
      () => callMethod(TEST_AUTH_METHODS.latestMailFor, [otherRunEmail]),
      /outside the current test run/i,
    );
    await assert.rejects(
      () => callMethod(TEST_AUTH_METHODS.latestMailFor, [123]),
      /invalid-test-email|invalid arguments/i,
    );
    await assert.rejects(
      () => callMethod(TEST_AUTH_METHODS.reset, ['extra-arg']),
      /invalid arguments/i,
    );

    await resetTestAuthData();

    assert.equal(await findUserByEmail(ownedEmail, { _id: 1 }), null);
    assert.ok(await findUserByEmail(otherRunEmail, { _id: 1 }));
    assert.ok(await findUserByEmail(unownedEmail, { _id: 1 }));
    assert.equal(environment.runId.startsWith('rr-integration-'), true);
  });

  it('creates a new unverified account on request and verifies it on link redemption', async () => {
    const email = uniqueEmail('new-user');
    const result = await requestLink(`  ${email.toUpperCase()}  `, '/account');

    assert.deepEqual(result, {
      acknowledged: true,
      expiresInMinutes: PASSWORDLESS_LINK_EXPIRY_MINUTES,
    });

    const createdUser = await findUserByEmail(email, {
      emails: 1,
      roles: 1,
      services: 1,
    });

    assert.ok(createdUser);
    assert.equal(createdUser.emails?.[0]?.address, email);
    assert.equal(createdUser.emails?.[0]?.verified, false);
    assert.equal((createdUser as { roles?: unknown }).roles, undefined);
    assert.ok(
      (createdUser as { services?: { passwordless?: unknown } }).services
        ?.passwordless,
      'request stores a package passwordless token',
    );

    const link = getLinkParts(email);
    const helperMail = await callMethod<{ readonly url: string }>(
      TEST_AUTH_METHODS.latestMailFor,
      [email],
    );

    assert.equal(helperMail.url, link.url.toString());
    assert.equal(link.returnTo, '/account');
    assert.equal(link.url.pathname, '/auth/email-link');
    assert.equal(link.url.searchParams.has('loginToken'), false);

    const invocation = makeInvocation('new-user-login');
    const login = await loginWithLink(link.email, link.token, invocation);

    assert.equal(login.id, createdUser._id);
    assert.equal(invocation.userId, createdUser._id);
    assert.ok(login.token);
    assert.ok(login.tokenExpires instanceof Date);

    const expectedMs = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const actualMs = login.tokenExpires.getTime() - Date.now();
    assert.ok(actualMs > expectedMs - 60_000);
    assert.ok(actualMs <= expectedMs + 60_000);

    const verifiedUser = await findUserByEmail(email, {
      emails: 1,
      services: 1,
    });

    assert.equal(verifiedUser?.emails?.[0]?.verified, true);
    assert.equal(
      (verifiedUser as { services?: { passwordless?: unknown } }).services
        ?.passwordless,
      undefined,
    );

    await callMethod('logout', [], invocation);

    assert.equal(invocation.userId, null);
  });

  it('returns an existing player to the same account and invalidates previous resend links', async () => {
    const email = uniqueEmail('returning');

    await requestLink(email);
    const firstLink = getLinkParts(email);
    const firstLogin = await loginWithLink(firstLink.email, firstLink.token);

    await requestLink(email.toUpperCase(), '/games');
    const staleLink = getLinkParts(email);
    await requestLink(` ${email} `, '/account');
    const latestLink = getLinkParts(email);

    await assert.rejects(
      () => loginWithLink(staleLink.email, staleLink.token),
      /Something went wrong|invalid|expired/i,
    );

    const secondLogin = await loginWithLink(latestLink.email, latestLink.token);

    assert.equal(secondLogin.id, firstLogin.id);
    assert.equal(
      await Meteor.users.find({ 'emails.address': email }).countAsync(),
      1,
    );
  });

  it('normalizes case and whitespace without stripping plus addressing', async () => {
    const plusEmail = uniqueEmail('plus+tag');
    const baseEmail = plusEmail.replace('+tag', '');

    await requestLink(` ${plusEmail.toUpperCase()} `);
    await requestLink(baseEmail);

    assert.equal(
      await Meteor.users
        .find({
          'emails.address': {
            $in: [plusEmail, baseEmail],
          },
        })
        .countAsync(),
      2,
    );
  });

  it('rejects invalid, expired, replayed, and concurrent token redemption', async () => {
    const email = uniqueEmail('tokens');

    await requestLink(email);
    const link = getLinkParts(email);

    await assert.rejects(
      () => loginWithLink(link.email, 'BADTOKEN'),
      /Something went wrong|invalid|expired/i,
    );

    await Meteor.users.updateAsync(
      { 'emails.address': email },
      {
        $set: {
          'services.passwordless.createdAt': new Date(
            Date.now() - (PASSWORDLESS_LINK_EXPIRY_MINUTES + 1) * 60 * 1000,
          ),
        },
      },
    );

    await assert.rejects(
      () => loginWithLink(link.email, link.token),
      /Something went wrong|invalid|expired/i,
    );

    await requestLink(email);
    const replayLink = getLinkParts(email);
    await loginWithLink(replayLink.email, replayLink.token);

    await assert.rejects(
      () => loginWithLink(replayLink.email, replayLink.token),
      /Something went wrong|invalid|expired/i,
    );

    await requestLink(email);
    const concurrentLink = getLinkParts(email);
    const attempts = await Promise.allSettled([
      loginWithLink(
        concurrentLink.email,
        concurrentLink.token,
        makeInvocation('concurrent-a'),
      ),
      loginWithLink(
        concurrentLink.email,
        concurrentLink.token,
        makeInvocation('concurrent-b'),
      ),
    ]);

    assert.equal(
      attempts.filter((attempt) => attempt.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      attempts.filter((attempt) => attempt.status === 'rejected').length,
      1,
    );
  });

  it('protects direct package entry points from arbitrary selectors and malicious user data', async () => {
    const email = uniqueEmail('abuse');

    await assert.rejects(
      () =>
        directPackageRequest({
          selector: { id: 'target-user-id' },
          userData: {
            email,
            profile: { roles: { platformAdmin: true } },
          },
        }),
      /email/i,
    );

    await directPackageRequest({
      options: {
        extra: {
          returnTo: 'https://evil.example/admin',
        },
      },
      selector: { email },
      userData: {
        email,
        profile: { roles: { platformAdmin: true } },
        roles: { platformAdmin: true },
      },
    });

    const user = (await findUserByEmail(email, {
      emails: 1,
      profile: 1,
      roles: 1,
    })) as Meteor.User & { profile?: unknown; roles?: unknown };

    assert.ok(user);
    assert.equal(user.profile, undefined);
    assert.equal(user.roles, undefined);
    assert.equal(getLinkParts(email).returnTo, '/games');

    const link = getLinkParts(email);
    await assert.rejects(
      () =>
        callMethod('login', [
          {
            selector: { id: user._id },
            token: link.token,
          },
        ]),
      /invalid-login-selector|invalid/i,
    );
  });

  it('sends admin-directed links only to verified platform admins', async () => {
    const adminEmail = uniqueEmail('admin-link');
    const ordinaryEmail = uniqueEmail('ordinary-admin-link');
    const unverifiedEmail = uniqueEmail('unverified-admin-link');
    const unknownEmail = uniqueEmail('unknown-admin-link');
    const expectedAcknowledgement = {
      acknowledged: true,
      expiresInMinutes: PASSWORDLESS_LINK_EXPIRY_MINUTES,
    };

    await callMethod(TEST_AUTH_METHODS.createVerifiedUser, [adminEmail]);
    await callMethod(TEST_AUTH_METHODS.createVerifiedUser, [ordinaryEmail]);
    assert.equal(await grantPlatformAdminByEmail(adminEmail), true);

    await requestLink(unverifiedEmail, '/account');
    const unverifiedUser = await findUserByEmail(unverifiedEmail, { _id: 1 });
    assert.ok(unverifiedUser);
    await Meteor.users.updateAsync(unverifiedUser._id, {
      $set: {
        'roles.platformAdmin': true,
      },
    });

    const unverifiedMailBefore = latestCapturedMailFor(unverifiedEmail);

    assert.deepEqual(
      await requestAdminLink(adminEmail),
      expectedAcknowledgement,
    );
    assert.deepEqual(
      await requestAdminLink(ordinaryEmail),
      expectedAcknowledgement,
    );
    assert.deepEqual(
      await requestAdminLink(unverifiedEmail),
      expectedAcknowledgement,
    );
    assert.deepEqual(
      await requestAdminLink(unknownEmail),
      expectedAcknowledgement,
    );

    const adminLink = getLinkParts(adminEmail);
    assert.equal(adminLink.returnTo, '/admin');
    assert.equal(adminLink.url.pathname, '/auth/email-link');
    assert.equal(latestCapturedMailFor(ordinaryEmail), undefined);
    assert.equal(latestCapturedMailFor(unverifiedEmail), unverifiedMailBefore);
    assert.equal(latestCapturedMailFor(unknownEmail), undefined);
    assert.equal(await findUserByEmail(unknownEmail, { _id: 1 }), null);
  });

  it('preserves existing token state for ineligible admin-directed requests', async () => {
    const email = uniqueEmail('admin-token-preserve');

    await callMethod(TEST_AUTH_METHODS.createVerifiedUser, [email]);
    await requestLink(email, '/account');

    const mailBefore = latestCapturedMailFor(email);
    const passwordlessBefore = await getPasswordlessStateForEmail(email);

    assert.ok(mailBefore);

    await requestAdminLink(email);
    await directPackageRequest({
      email,
      returnTo: '/admin',
    });

    assert.equal(latestCapturedMailFor(email)?.id, mailBefore.id);
    assert.deepEqual(
      await getPasswordlessStateForEmail(email),
      passwordlessBefore,
    );
  });

  it('does not allow general or package request paths to bypass admin eligibility', async () => {
    const email = uniqueEmail('admin-bypass');

    await callMethod(TEST_AUTH_METHODS.createVerifiedUser, [email]);

    const generalResult = await requestLink(email, '/admin');
    const packageResult = await directPackageRequest({
      options: {
        extra: {
          returnTo: '/admin',
        },
      },
      selector: {
        email,
      },
      userData: {
        email,
      },
    });

    assert.deepEqual(generalResult, packageResult);
    assert.deepEqual(generalResult, {
      acknowledged: true,
      expiresInMinutes: PASSWORDLESS_LINK_EXPIRY_MINUTES,
    });
    assert.equal(latestCapturedMailFor(email), undefined);
    assert.equal(await getPasswordlessStateForEmail(email), null);
  });

  it('rate limits ineligible admin-directed link requests', async () => {
    const email = uniqueEmail('admin-throttle');

    await requestAdminLink(email);
    await requestAdminLink(email);
    await requestAdminLink(email);

    await assert.rejects(() => requestAdminLink(email), /Too many attempts/i);
    assert.equal(await findUserByEmail(email, { _id: 1 }), null);
    assert.equal(latestCapturedMailFor(email), undefined);
  });

  it('does not grant admin access when an admin grant is revoked after link sending', async () => {
    const email = uniqueEmail('admin-revoked-link');
    const invocation = makeInvocation('admin-revoked-link');

    await callMethod(TEST_AUTH_METHODS.createVerifiedUser, [email]);
    assert.equal(await grantPlatformAdminByEmail(email), true);
    await requestAdminLink(email);

    const link = getLinkParts(email);
    assert.equal(await revokePlatformAdminByEmail(email), true);

    await loginWithLink(link.email, link.token, invocation);

    const access = await callMethod<CurrentAccessResult>(
      AUTH_METHODS.currentAccess,
      [],
      invocation,
    );

    assert.equal(access.isAuthenticated, true);
    assert.equal(access.isVerified, true);
    assert.equal(access.isPlatformAdmin, false);
    await assert.rejects(
      () => callMethod(ADMIN_METHODS.accessSummary, [], invocation),
      /admin area|access/i,
    );
  });

  it('throttles link requests by email identity and by shared-address aggregate', async () => {
    const email = uniqueEmail('throttle-email');

    await requestLink(email);
    await requestLink(email);
    await requestLink(email);

    await assert.rejects(() => requestLink(email), /Too many attempts/i);

    await resetTestAuthData();

    const invocation = makeInvocation('same-address', '198.51.100.44');
    const aggregateLimit =
      AUTH_THROTTLE_LIMITS.linkRequestByAddressAggregate.limit;

    for (let index = 0; index < 12; index += 1) {
      await requestLink(
        uniqueEmail(`shared-address-player-${index}`),
        '/games',
        invocation,
      );
    }

    for (let index = 12; index < aggregateLimit; index += 1) {
      await requestLink(
        uniqueEmail(`shared-address-fill-${index}`),
        '/games',
        invocation,
      );
    }

    await assert.rejects(
      () =>
        requestLink(
          uniqueEmail('shared-address-blocked'),
          '/games',
          invocation,
        ),
      /Too many attempts/i,
    );
  });

  it('prunes expired in-memory throttle buckets', () => {
    resetAuthThrottlesForTests();

    checkAuthThrottle(AUTH_THROTTLE_LIMITS.linkRequestByEmail, 'old-a', 0);
    checkAuthThrottle(AUTH_THROTTLE_LIMITS.linkRequestByEmail, 'old-b', 0);
    assert.equal(getAuthThrottleBucketCountForTests(), 2);

    checkAuthThrottle(
      AUTH_THROTTLE_LIMITS.linkRequestByEmail,
      'new-c',
      AUTH_THROTTLE_LIMITS.linkRequestByEmail.windowMs + 1,
    );

    assert.equal(getAuthThrottleBucketCountForTests(), 1);
  });

  it('throttles token redemption attempts for the package login path', async () => {
    const email = uniqueEmail('redeem-throttle');

    await requestLink(email);

    for (let index = 0; index < 8; index += 1) {
      await assert.rejects(
        () => loginWithLink(email, `BAD${index}`),
        /Something went wrong|invalid|expired/i,
      );
    }

    await assert.rejects(
      () => loginWithLink(email, 'BAD-FINAL'),
      /Too many attempts/i,
    );
  });

  it('reports mail delivery failure without returning a false success', async () => {
    const email = uniqueEmail('mail-failure');

    failNextLocalMailForTests();

    await assert.rejects(
      () => requestLink(email),
      /could not send a sign-in link/i,
    );
    assert.equal(latestCapturedMailFor(email), undefined);
  });

  it('enforces player and platform-admin permission boundaries with revocation', async () => {
    const playerEmail = uniqueEmail('player');

    await assert.rejects(
      () => callMethod(ADMIN_METHODS.accessSummary),
      /Sign in to continue/i,
    );

    await requestLink(playerEmail);
    const playerLink = getLinkParts(playerEmail);
    const playerInvocation = makeInvocation('player-session');
    await loginWithLink(playerLink.email, playerLink.token, playerInvocation);

    const access = await callMethod<CurrentAccessResult>(
      AUTH_METHODS.currentAccess,
      [],
      playerInvocation,
    );

    assert.equal(access.isAuthenticated, true);
    assert.equal(access.isVerified, true);
    assert.equal(access.isPlatformAdmin, false);

    await assert.rejects(
      () => callMethod(ADMIN_METHODS.accessSummary, [], playerInvocation),
      /admin area|access/i,
    );

    assert.equal(await grantPlatformAdminByEmail(playerEmail), true);

    const adminSummary = await callMethod(
      ADMIN_METHODS.accessSummary,
      [],
      playerInvocation,
    );

    assert.ok(adminSummary);

    assert.equal(await revokePlatformAdminByEmail(playerEmail), true);
    await assert.rejects(
      () => callMethod(ADMIN_METHODS.accessSummary, [], playerInvocation),
      /admin area|access/i,
    );
  });

  it('keeps the current-user publication field set narrow', () => {
    const projection = (
      Accounts as unknown as {
        _defaultPublishFields: { projection: Record<string, 0 | 1> };
      }
    )._defaultPublishFields.projection;

    assert.deepEqual(projection, {
      emails: 1,
      roles: 1,
    });
    assert.equal('services' in projection, false);
    assert.equal('profile' in projection, false);
  });

  it('validates safe return destinations centrally', () => {
    assert.equal(resolveSafeReturnPath('/account'), '/account');
    assert.equal(resolveSafeReturnPath('/admin'), '/admin');
    assert.equal(
      resolveSafeReturnPath('/fixtures/abc_123?tab=predictions&utm=ad'),
      '/fixtures/abc_123?tab=predictions',
    );
    assert.equal(resolveSafeReturnPath('https://evil.example/admin'), '/games');
    assert.equal(resolveSafeReturnPath('//evil.example/admin'), '/games');
    assert.equal(resolveSafeReturnPath('javascript:alert(1)'), '/games');
    assert.equal(resolveSafeReturnPath('/unknown'), '/games');
  });
});
