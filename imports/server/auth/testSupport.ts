import { Meteor } from 'meteor/meteor';

import { TEST_AUTH_METHODS } from '/imports/shared/auth/methods';
import { normalizeEmailIdentity } from '/imports/shared/auth/email';
import {
  failNextLocalMailForTests,
  latestCapturedMailFor,
  resetLocalMailSinkForTests,
} from './mailSink';
import { resetAuthThrottlesForTests } from './throttle';
import { areTestHelpersEnabled } from './settings';
import {
  grantPlatformAdminByEmail,
  revokePlatformAdminByEmail,
} from './authorization';

const TEST_EMAIL_PATTERN = /@example\.test$/;

export const resetTestAuthData = async () => {
  await Meteor.users.removeAsync({
    'emails.address': {
      $regex: TEST_EMAIL_PATTERN,
    },
  });
  resetLocalMailSinkForTests();
  resetAuthThrottlesForTests();
};

export const registerAuthTestMethods = () => {
  if (!areTestHelpersEnabled()) {
    return;
  }

  Meteor.methods({
    [TEST_AUTH_METHODS.reset]: async function reset() {
      await resetTestAuthData();

      return true;
    },

    [TEST_AUTH_METHODS.latestMailFor]: function latestMailFor(email: string) {
      const message = latestCapturedMailFor(email);

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
      email: string,
    ) {
      const normalizedEmail = normalizeEmailIdentity(email);

      if (!TEST_EMAIL_PATTERN.test(normalizedEmail)) {
        throw new Meteor.Error(
          'invalid-test-email',
          'Test helpers only create example.test accounts.',
        );
      }

      const userId = await Meteor.users.insertAsync({
        createdAt: new Date(),
        emails: [
          {
            address: normalizedEmail,
            verified: true,
          },
        ],
        services: {},
      });

      return {
        email: normalizedEmail,
        userId,
      };
    },

    [TEST_AUTH_METHODS.setAdminForEmail]: async function setAdminForEmail(
      email: string,
      grant: boolean,
    ) {
      const normalizedEmail = normalizeEmailIdentity(email);

      if (!TEST_EMAIL_PATTERN.test(normalizedEmail)) {
        throw new Meteor.Error(
          'invalid-test-email',
          'Test helpers only update example.test accounts.',
        );
      }

      return grant
        ? grantPlatformAdminByEmail(normalizedEmail)
        : revokePlatformAdminByEmail(normalizedEmail);
    },

    'test.mail.failNext': function failNextMail() {
      failNextLocalMailForTests();

      return true;
    },
  });
};
