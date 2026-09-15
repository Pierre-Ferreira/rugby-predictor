import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';

import { normalizeEmailIdentity } from '/imports/shared/auth/email';
import { getRugbyRoosterSettings } from './settings';

interface UserEmail {
  readonly address: string;
  readonly verified: boolean;
}

type RugbyRoosterUser = Omit<Meteor.User, 'emails'> & {
  readonly emails?: UserEmail[];
  readonly roles?: {
    readonly platformAdmin?: boolean;
  };
};

const userFieldsForAuth = {
  emails: 1,
  roles: 1,
} as const;

export const getPrimaryEmail = (
  user: Pick<RugbyRoosterUser, 'emails'> | null | undefined,
): string | null => user?.emails?.[0]?.address ?? null;

export const hasVerifiedEmail = (
  user: Pick<RugbyRoosterUser, 'emails'> | null | undefined,
): boolean => user?.emails?.some((email) => email.verified === true) ?? false;

export const isPlatformAdminUser = (
  user: Pick<RugbyRoosterUser, 'roles'> | null | undefined,
): boolean => user?.roles?.platformAdmin === true;

export const getUserForAuth = async (
  userId: string,
): Promise<RugbyRoosterUser | null> =>
  (await Meteor.users.findOneAsync(userId, {
    fields: userFieldsForAuth,
  })) as RugbyRoosterUser | null;

export const requireAuthenticatedUserId = (
  invocation: Pick<Meteor.MethodThisType, 'userId'>,
): string => {
  if (!invocation.userId) {
    throw new Meteor.Error('not-authenticated', 'Sign in to continue.');
  }

  return invocation.userId;
};

export const requireVerifiedUser = async (
  invocation: Pick<Meteor.MethodThisType, 'userId'>,
): Promise<RugbyRoosterUser> => {
  const userId = requireAuthenticatedUserId(invocation);
  const user = await getUserForAuth(userId);

  if (!user || !hasVerifiedEmail(user)) {
    throw new Meteor.Error(
      'email-not-verified',
      'Verify your email address before continuing.',
    );
  }

  return user;
};

export const requirePlatformAdmin = async (
  invocation: Pick<Meteor.MethodThisType, 'userId'>,
): Promise<RugbyRoosterUser> => {
  const user = await requireVerifiedUser(invocation);

  if (!isPlatformAdminUser(user)) {
    throw new Meteor.Error(
      'not-authorized',
      'You do not have access to the admin area.',
    );
  }

  return user;
};

export const grantPlatformAdminByEmail = async (
  email: string,
): Promise<boolean> => {
  const normalizedEmail = normalizeEmailIdentity(email);
  const findUserByEmail = Accounts.findUserByEmail as unknown as (
    emailAddress: string,
    options: unknown,
  ) => Promise<RugbyRoosterUser | null>;
  const user = await findUserByEmail(normalizedEmail, {
    fields: userFieldsForAuth,
  });

  if (!user || !hasVerifiedEmail(user)) {
    return false;
  }

  await Meteor.users.updateAsync(user._id, {
    $set: {
      'roles.platformAdmin': true,
    },
  });

  return true;
};

export const revokePlatformAdminByEmail = async (
  email: string,
): Promise<boolean> => {
  const normalizedEmail = normalizeEmailIdentity(email);
  const findUserByEmail = Accounts.findUserByEmail as unknown as (
    emailAddress: string,
    options: unknown,
  ) => Promise<RugbyRoosterUser | null>;
  const user = await findUserByEmail(normalizedEmail, {
    fields: { _id: 1 },
  });

  if (!user) {
    return false;
  }

  await Meteor.users.updateAsync(user._id, {
    $unset: {
      'roles.platformAdmin': 1,
    },
  });

  return true;
};

export const provisionPlatformAdminFromSettings = async () => {
  const provisioning = getRugbyRoosterSettings().adminProvisioning;

  if (!provisioning?.action || !provisioning.email) {
    return;
  }

  if (provisioning.action === 'grant') {
    const granted = await grantPlatformAdminByEmail(provisioning.email);

    if (!granted) {
      console.warn(
        'Rugby Rooster admin provisioning skipped: account was not found or verified.',
      );
    }

    return;
  }

  if (provisioning.action === 'revoke') {
    await revokePlatformAdminByEmail(provisioning.email);
  }
};
