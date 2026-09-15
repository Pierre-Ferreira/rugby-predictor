import { Meteor } from 'meteor/meteor';

import {
  ADMIN_METHODS,
  AUTH_METHODS,
  type CurrentAccessResult,
} from '/imports/shared/auth/methods';
import { resolveSafeReturnPath } from '/imports/shared/auth/redirects';
import { AUTH_PACKAGE_VERSIONS } from './accounts';
import {
  getPrimaryEmail,
  getUserForAuth,
  hasVerifiedEmail,
  isPlatformAdminUser,
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

export const registerAuthMethods = () => {
  Meteor.methods({
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
