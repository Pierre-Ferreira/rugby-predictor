import { createHash } from 'node:crypto';

import { Meteor } from 'meteor/meteor';

import {
  ADMIN_METHODS,
  AUTH_METHODS,
  type CurrentAccessResult,
  type InvalidateSameAccountSignInLinkResult,
} from '/imports/shared/auth/methods';
import {
  PASSWORDLESS_LINK_EXPIRY_MINUTES,
  PASSWORDLESS_TOKEN_SEQUENCE_LENGTH,
} from '/imports/shared/auth/constants';
import { validateEmailIdentity } from '/imports/shared/auth/email';
import { resolveSafeReturnPath } from '/imports/shared/auth/redirects';
import { AUTH_PACKAGE_VERSIONS } from './accounts';
import {
  getPrimaryEmail,
  getUserForAuth,
  hasVerifiedEmailAddress,
  hasVerifiedEmail,
  isPlatformAdminUser,
  requireVerifiedUser,
  requirePlatformAdmin,
} from './authorization';

type MethodHandler = (
  this: Meteor.MethodThisType,
  ...args: readonly unknown[]
) => Promise<unknown>;

const methodHandlers = (): Record<string, MethodHandler> =>
  (
    Meteor as unknown as {
      server: {
        method_handlers: Record<string, MethodHandler>;
      };
    }
  ).server.method_handlers;

const invalidSignInLinkError = (): Meteor.Error =>
  new Meteor.Error(
    'invalid-sign-in-link',
    'This sign-in link is invalid, expired, already used, or has been replaced. Request a new link to continue.',
  );

const parsePasswordlessLinkCredentials = (input: unknown) => {
  if (!input || typeof input !== 'object') {
    throw invalidSignInLinkError();
  }

  const record = input as {
    readonly email?: unknown;
    readonly token?: unknown;
  };
  const emailValidation = validateEmailIdentity(record.email);

  if (
    !emailValidation.isValid ||
    typeof record.token !== 'string' ||
    record.token.length < 1 ||
    record.token.length > PASSWORDLESS_TOKEN_SEQUENCE_LENGTH
  ) {
    throw invalidSignInLinkError();
  }

  return {
    email: emailValidation.email,
    token: record.token.toUpperCase(),
  };
};

const passwordlessEmailTokenHash = (email: string, token: string): string =>
  createHash('sha256').update(`${email}${token}`, 'utf8').digest('hex');

export const registerAuthMethods = () => {
  Meteor.methods({
    [AUTH_METHODS.requestAdminSignInLink]:
      async function requestAdminSignInLink(input: unknown) {
        if (!input || typeof input !== 'object') {
          throw new Meteor.Error('invalid-request', 'Enter an email address.');
        }

        const record = input as {
          readonly email?: unknown;
        };

        return methodHandlers().requestLoginTokenForUser.call(this, {
          email: record.email,
          returnTo: '/admin',
        });
      },

    [AUTH_METHODS.requestSignInLink]: async function requestSignInLink(
      input: unknown,
    ) {
      if (!input || typeof input !== 'object') {
        throw new Meteor.Error('invalid-request', 'Enter an email address.');
      }

      const record = input as {
        readonly email?: unknown;
        readonly returnTo?: unknown;
      };

      return methodHandlers().requestLoginTokenForUser.call(this, {
        email: record.email,
        returnTo: resolveSafeReturnPath(record.returnTo),
      });
    },

    [AUTH_METHODS.invalidateSameAccountSignInLink]:
      async function invalidateSameAccountSignInLink(
        input: unknown,
      ): Promise<InvalidateSameAccountSignInLinkResult> {
        const credentials = parsePasswordlessLinkCredentials(input);
        const user = await requireVerifiedUser(this);
        const userId = this.userId;

        if (!userId || !hasVerifiedEmailAddress(user, credentials.email)) {
          throw invalidSignInLinkError();
        }

        const tokenHash = passwordlessEmailTokenHash(
          credentials.email,
          credentials.token,
        );
        const createdAfter = new Date(
          Date.now() - PASSWORDLESS_LINK_EXPIRY_MINUTES * 60 * 1000,
        );

        const updatedCount = await Meteor.users.updateAsync(
          {
            _id: userId,
            emails: {
              $elemMatch: {
                address: credentials.email,
                verified: true,
              },
            },
            'services.passwordless.createdAt': {
              $gt: createdAfter,
            },
            'services.passwordless.tokens': {
              $elemMatch: {
                email: credentials.email,
                token: tokenHash,
              },
            },
          },
          {
            $unset: {
              'services.passwordless': 1,
            },
          },
        );

        if (updatedCount !== 1) {
          throw invalidSignInLinkError();
        }

        return {
          invalidated: true,
        };
      },

    [AUTH_METHODS.currentAccess]:
      async function currentAccess(): Promise<CurrentAccessResult> {
        if (!this.userId) {
          return {
            email: null,
            isAuthenticated: false,
            isPlatformAdmin: false,
            isVerified: false,
            userId: null,
          };
        }

        const user = await getUserForAuth(this.userId);

        return {
          email: getPrimaryEmail(user),
          isAuthenticated: true,
          isPlatformAdmin: isPlatformAdminUser(user),
          isVerified: hasVerifiedEmail(user),
          userId: this.userId,
        };
      },

    [ADMIN_METHODS.accessSummary]: async function accessSummary() {
      await requirePlatformAdmin(this);

      const [users, verifiedEmailUsers] = await Promise.all([
        Meteor.users.find().countAsync(),
        Meteor.users
          .find({
            emails: {
              $elemMatch: {
                verified: true,
              },
            },
          })
          .countAsync(),
      ]);

      return {
        generatedAt: new Date().toISOString(),
        packageVersions: AUTH_PACKAGE_VERSIONS,
        totals: {
          users,
          verifiedEmailUsers,
        },
      };
    },
  });
};
