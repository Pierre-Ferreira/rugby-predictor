import assert from 'node:assert/strict';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';

import { PlayerProfiles } from '/imports/api/playerProfiles/collection';
import { TEST_AUTH_METHODS } from '/imports/shared/auth/methods';
import {
  PLAYER_PROFILE_METHODS,
  type PublicPlayerIdentity,
} from '/imports/shared/playerProfiles';
import { getAuthTestRunId } from '/imports/server/auth/settings';
import { resetTestAuthData } from '/imports/server/auth/testSupport';
import { resetPlayerProfileTestData } from '/imports/server/playerProfiles/testSupport';
import { resolvePublicPlayerIdentities } from './service';

type MethodHandler = (
  this: Meteor.MethodThisType,
  ...args: unknown[]
) => Promise<unknown>;

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

const makeInvocation = (label = Random.id()): TestInvocation => {
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
      clientAddress: '127.0.0.1',
      close: () => undefined,
      id: `player-profile-test-${label}`,
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
  `ccpp012a-${prefix}-${Random.id().toLowerCase()}@example.test`;

const createVerifiedPlayer = async (label = 'player') => {
  const email = uniqueEmail(label);
  const user = await callMethod<{
    readonly email: string;
    readonly userId: string;
  }>(TEST_AUTH_METHODS.createVerifiedUser, [email]);
  const invocation = makeInvocation(label);
  invocation.userId = user.userId;

  return {
    email,
    invocation,
    userId: user.userId,
  };
};

const createUnverifiedPlayer = async () => {
  const ownerRunId = getAuthTestRunId();

  assert.ok(ownerRunId, 'player profile test run id exists');

  const userId = await Meteor.users.insertAsync({
    createdAt: new Date(),
    emails: [
      {
        address: uniqueEmail('unverified'),
        verified: false,
      },
    ],
    rugbyRoosterTest: {
      ownerRunId,
    },
    services: {},
  } as unknown as Meteor.User);
  const invocation = makeInvocation('unverified');
  invocation.userId = userId;

  return {
    invocation,
    userId,
  };
};

const getMine = (invocation: TestInvocation) =>
  callMethod<PublicPlayerIdentity>(
    PLAYER_PROFILE_METHODS.getMine,
    [],
    invocation,
  );

const updateMine = (invocation: TestInvocation, input: unknown) =>
  callMethod<PublicPlayerIdentity>(
    PLAYER_PROFILE_METHODS.updateMine,
    [input],
    invocation,
  );

describe('player profile methods', function () {
  this.timeout(20_000);

  beforeEach(async () => {
    await resetPlayerProfileTestData();
    await resetTestAuthData();
  });

  it('denies unauthenticated and unverified read/update attempts', async () => {
    const unverified = await createUnverifiedPlayer();

    await assert.rejects(
      () => getMine(makeInvocation('anonymous')),
      /Sign in to continue|not-authenticated/i,
    );
    await assert.rejects(
      () => updateMine(makeInvocation('anonymous'), { displayName: 'Pierre' }),
      /Sign in to continue|not-authenticated/i,
    );
    await assert.rejects(
      () => getMine(unverified.invocation),
      /Verify your email address|email-not-verified/i,
    );
    await assert.rejects(
      () => updateMine(unverified.invocation, { displayName: 'Pierre' }),
      /Verify your email address|email-not-verified/i,
    );
  });

  it('allows a verified player to read and update only their own display name', async () => {
    const player = await createVerifiedPlayer();

    assert.deepEqual(await getMine(player.invocation), {
      displayName: null,
    });

    assert.deepEqual(
      await updateMine(player.invocation, {
        displayName: '  Pierre   du  Plessis  ',
      }),
      {
        displayName: 'Pierre du Plessis',
      },
    );
    assert.deepEqual(await getMine(player.invocation), {
      displayName: 'Pierre du Plessis',
    });

    const profiles = await PlayerProfiles.find({
      userId: player.userId,
    }).fetchAsync();

    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].displayName, 'Pierre du Plessis');
    assert.equal(
      'email' in (profiles[0] as unknown as Record<string, unknown>),
      false,
    );
  });

  it('does not create duplicates when the owner changes display name', async () => {
    const player = await createVerifiedPlayer();

    await updateMine(player.invocation, { displayName: 'Pierre' });
    await updateMine(player.invocation, { displayName: 'Pete' });

    const profiles = await PlayerProfiles.find({
      userId: player.userId,
    }).fetchAsync();

    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].displayName, 'Pete');
  });

  it('rejects userId and extra field injection without touching another account', async () => {
    const player = await createVerifiedPlayer('player');
    const other = await createVerifiedPlayer('other');

    await updateMine(other.invocation, { displayName: 'Alice' });

    await assert.rejects(
      () =>
        updateMine(player.invocation, {
          displayName: 'Pierre',
          userId: other.userId,
        }),
      /unsupported fields: userId|unknown-player-profile-field/i,
    );
    await assert.rejects(
      () =>
        updateMine(player.invocation, {
          displayName: 'Pierre',
          roles: {
            platformAdmin: true,
          },
        }),
      /unsupported fields: roles|unknown-player-profile-field/i,
    );

    assert.deepEqual(await getMine(other.invocation), {
      displayName: 'Alice',
    });
    assert.deepEqual(await getMine(player.invocation), {
      displayName: null,
    });
  });

  it('keeps public method responses free of email, user id, roles, and auth metadata', async () => {
    const player = await createVerifiedPlayer('private');

    const identity = await updateMine(player.invocation, {
      displayName: 'José',
    });
    const serialized = JSON.stringify(identity);

    assert.deepEqual(identity, {
      displayName: 'José',
    });
    assert.equal(serialized.includes(player.email), false);
    assert.equal(serialized.includes(player.userId), false);
    assert.equal(serialized.includes('"userId"'), false);
    assert.equal(serialized.includes('"email"'), false);
    assert.equal(serialized.includes('"emails"'), false);
    assert.equal(serialized.includes('"roles"'), false);
    assert.equal(serialized.includes('"services"'), false);
    assert.equal(serialized.includes('"passwordless"'), false);
  });

  it('resolves public player identities in a batch and treats missing profiles as normal', async () => {
    const playerA = await createVerifiedPlayer('a');
    const playerB = await createVerifiedPlayer('b');
    const missing = await createVerifiedPlayer('missing');

    await updateMine(playerA.invocation, { displayName: 'Pierre' });
    await updateMine(playerB.invocation, { displayName: 'Alice' });

    const identities = await resolvePublicPlayerIdentities([
      playerA.userId,
      playerB.userId,
      missing.userId,
      playerA.userId,
    ]);

    assert.deepEqual(identities.get(playerA.userId), {
      displayName: 'Pierre',
    });
    assert.deepEqual(identities.get(playerB.userId), {
      displayName: 'Alice',
    });
    assert.deepEqual(identities.get(missing.userId), {
      displayName: null,
    });
    assert.equal(
      JSON.stringify(identities.get(playerA.userId)).includes(playerA.email),
      false,
    );
    assert.equal(
      JSON.stringify(identities.get(playerA.userId)).includes('roles'),
      false,
    );
  });

  it('denies direct client collection writes', async () => {
    const player = await createVerifiedPlayer('client-write');

    await assert.rejects(
      () =>
        callMethod(
          '/player_profiles/insert',
          [
            {
              _id: Random.id(),
              createdAt: new Date(),
              displayName: 'Injected',
              updatedAt: new Date(),
              userId: player.userId,
            },
          ],
          player.invocation,
        ),
      /Access denied|not allowed|not-authorized|403/i,
    );
    await assert.rejects(
      () =>
        callMethod(
          '/player_profiles/update',
          [
            {
              userId: player.userId,
            },
            {
              $set: {
                displayName: 'Injected',
              },
            },
          ],
          player.invocation,
        ),
      /Access denied|not allowed|not-authorized|403/i,
    );
    await assert.rejects(
      () =>
        callMethod(
          '/player_profiles/remove',
          [
            {
              userId: player.userId,
            },
          ],
          player.invocation,
        ),
      /Access denied|not allowed|not-authorized|403/i,
    );

    assert.equal(
      await PlayerProfiles.find({
        userId: player.userId,
      }).countAsync(),
      0,
    );
  });
});
