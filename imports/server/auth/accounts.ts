import { Accounts } from 'meteor/accounts-base';
import { Email } from 'meteor/email';
import { Meteor } from 'meteor/meteor';

import {
  PASSWORDLESS_LINK_EXPIRY_MINUTES,
  PASSWORDLESS_TOKEN_SEQUENCE_LENGTH,
  SESSION_EXPIRY_DAYS,
} from '/imports/shared/auth/constants';
import {
  normalizeEmailIdentity,
  validateEmailIdentity,
} from '/imports/shared/auth/email';
import { resolveSafeReturnPath } from '/imports/shared/auth/redirects';
import { withProcessLock } from './locks';
import { isVerifiedPlatformAdminEmail } from './authorization';
import {
  AUTH_THROTTLE_LIMITS,
  checkAuthThrottle,
  getThrottleIdentityForInvocation,
} from './throttle';
import {
  buildCanonicalUrl,
  getAuthTestRunId,
  getMailFromAddress,
  getMailReplyToAddress,
  getPostmarkMailSettings,
  shouldCaptureMailLocally,
} from './settings';
import { configureLocalMailSink } from './mailSink';
import { configurePostmarkMailTransport } from './postmarkTransport';

export const AUTH_PACKAGE_VERSIONS = {
  accountsBase: '3.3.1',
  accountsPasswordless: '3.1.1',
  ddpRateLimiter: '1.3.0',
  email: '3.2.0',
} as const;

type MethodHandler = (
  this: Meteor.MethodThisType,
  ...args: readonly unknown[]
) => Promise<unknown>;

interface PasswordlessEmailOptions {
  readonly email: string;
  readonly extra?: {
    readonly returnTo?: string;
  };
  readonly sequence: string;
  readonly userId: string;
}

interface AccountsPasswordlessApi {
  emailTemplates: {
    from?: string;
    sendLoginToken?: {
      from?: (user: Meteor.User) => string | Promise<string>;
      html?: (
        user: Meteor.User,
        url: string,
        extra: { readonly sequence: string },
      ) => string;
      subject: (user: Meteor.User, url: string) => string;
      text?: (
        user: Meteor.User,
        url: string,
        extra: { readonly sequence: string },
      ) => string;
    };
    siteName?: string;
  };
  generateOptionsForEmail: (
    email: string,
    user: Meteor.User,
    url: string,
    reason: 'sendLoginToken',
    extra: { readonly sequence: string },
  ) => Promise<Record<string, unknown>>;
  sendLoginTokenEmail: (options: PasswordlessEmailOptions) => Promise<unknown>;
  setDefaultPublishFields: (fields: Record<string, 0 | 1>) => void;
  urls: {
    loginToken: (
      selector: string,
      token: string,
      extra?: { readonly returnTo?: string },
    ) => string;
  };
}

const accounts = Accounts as typeof Accounts & AccountsPasswordlessApi;
const ADMIN_RETURN_PATH = '/admin';

const methodHandlers = (): Record<string, MethodHandler> =>
  (
    Meteor as unknown as {
      server: {
        method_handlers: Record<string, MethodHandler>;
      };
    }
  ).server.method_handlers;

const extractEmailFromRequestPayload = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const record = payload as {
    readonly email?: unknown;
    readonly selector?: { readonly email?: unknown };
  };

  return record.email ?? record.selector?.email;
};

const extractReturnToFromRequestPayload = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') {
    return resolveSafeReturnPath(undefined);
  }

  const record = payload as {
    readonly returnTo?: unknown;
    readonly options?: {
      readonly extra?: {
        readonly returnTo?: unknown;
      };
    };
  };

  return resolveSafeReturnPath(
    record.returnTo ?? record.options?.extra?.returnTo,
  );
};

const sanitizePasswordlessRequestPayload = (payload: unknown) => {
  const validation = validateEmailIdentity(
    extractEmailFromRequestPayload(payload),
  );

  if (!validation.isValid) {
    throw new Meteor.Error(
      'invalid-email',
      validation.reason ?? 'Enter a valid email address.',
    );
  }

  return {
    options: {
      extra: {
        returnTo: extractReturnToFromRequestPayload(payload),
      },
    },
    selector: {
      email: validation.email,
    },
    userData: {
      email: validation.email,
    },
  };
};

const isPasswordlessLoginOptions = (
  options: unknown,
): options is {
  readonly selector: { readonly email?: unknown; readonly id?: unknown };
  readonly token: unknown;
} =>
  Boolean(
    options &&
    typeof options === 'object' &&
    'token' in options &&
    'selector' in options,
  );

const sanitizePasswordlessLoginOptions = (options: unknown) => {
  if (!isPasswordlessLoginOptions(options)) {
    return null;
  }

  const selector = options.selector;
  const selectorKeys =
    selector && typeof selector === 'object' ? Object.keys(selector) : [];

  if (
    selectorKeys.length !== 1 ||
    !selectorKeys.includes('email') ||
    typeof selector.email !== 'string'
  ) {
    throw new Meteor.Error(
      'invalid-login-selector',
      'This sign-in link is invalid or expired.',
    );
  }

  const validation = validateEmailIdentity(selector.email);

  if (!validation.isValid || validation.email !== selector.email) {
    throw new Meteor.Error(
      'invalid-login-selector',
      'This sign-in link is invalid or expired.',
    );
  }

  if (
    typeof options.token !== 'string' ||
    !options.token ||
    options.token.length > PASSWORDLESS_TOKEN_SEQUENCE_LENGTH
  ) {
    throw new Meteor.Error(
      'invalid-login-token',
      'This sign-in link is invalid or expired.',
    );
  }

  return {
    selector: {
      email: validation.email,
    },
    token: options.token.toUpperCase(),
  };
};

const throwPublicDeliveryError = (): never => {
  throw new Meteor.Error(
    'email-delivery-failed',
    'We could not send a sign-in link right now. Please try again shortly.',
  );
};

const acknowledgePasswordlessRequest = () => ({
  acknowledged: true,
  expiresInMinutes: PASSWORDLESS_LINK_EXPIRY_MINUTES,
});

const logSanitizedDeliveryFailure = (
  context: 'admin' | 'player',
  error: unknown,
) => {
  const errorCode =
    error instanceof Meteor.Error
      ? error.error
      : error instanceof Error
        ? error.name
        : typeof error;

  console.warn('Rugby Rooster passwordless email delivery failed.', {
    context,
    errorCode,
  });
};

const findUserOwnershipByEmail = async (
  email: string,
): Promise<{ readonly ownerRunId?: string } | null> => {
  const user = (await Meteor.users.findOneAsync(
    {
      'emails.address': email,
    },
    {
      fields: {
        'rugbyRoosterTest.ownerRunId': 1,
      },
    },
  )) as {
    readonly rugbyRoosterTest?: {
      readonly ownerRunId?: string;
    };
  } | null;

  if (!user) {
    return null;
  }

  return {
    ownerRunId: user.rugbyRoosterTest?.ownerRunId,
  };
};

const markUserOwnedByCurrentTestRun = async (
  email: string,
  priorOwnership: { readonly ownerRunId?: string } | null,
) => {
  const testRunId = getAuthTestRunId();

  if (!testRunId) {
    return;
  }

  if (priorOwnership && priorOwnership.ownerRunId !== testRunId) {
    return;
  }

  await Meteor.users.updateAsync(
    {
      'emails.address': email,
    },
    {
      $set: {
        rugbyRoosterTest: {
          ownerRunId: testRunId,
        },
      },
    },
  );
};

export const configureAccounts = () => {
  (Accounts.config as (options: Record<string, unknown>) => void)({
    ambiguousErrorMessages: true,
    loginExpirationInDays: SESSION_EXPIRY_DAYS,
    loginTokenExpirationHours: PASSWORDLESS_LINK_EXPIRY_MINUTES / 60,
    tokenSequenceLength: PASSWORDLESS_TOKEN_SEQUENCE_LENGTH,
  });

  accounts.setDefaultPublishFields({
    emails: 1,
    roles: 1,
  });

  Accounts.onCreateUser((_options, user) => {
    const emails = user.emails?.map((email) => ({
      address: normalizeEmailIdentity(email.address),
      verified: email.verified === true,
    }));

    return {
      _id: user._id,
      createdAt: user.createdAt,
      emails,
      services: user.services ?? {},
    };
  });

  Meteor.users.deny({
    update: () => true,
  });
};

export const configureEmailDelivery = () => {
  if (shouldCaptureMailLocally()) {
    configureLocalMailSink({
      getTestRunId: getAuthTestRunId,
    });
    return;
  }

  const postmarkSettings = getPostmarkMailSettings();

  if (postmarkSettings) {
    configurePostmarkMailTransport(postmarkSettings);
  }
};

export const configurePasswordlessEmails = () => {
  accounts.urls.loginToken = (email, token, extra = {}) =>
    buildCanonicalUrl('/auth/email-link', {
      email: normalizeEmailIdentity(email),
      returnTo: resolveSafeReturnPath(extra.returnTo),
      token,
    });

  accounts.emailTemplates.siteName = 'Rugby Rooster';
  accounts.emailTemplates.from = getMailFromAddress();
  accounts.emailTemplates.sendLoginToken = {
    subject: () => 'Your Rugby Rooster sign-in link',
    text: (_user, url) =>
      [
        'Hello from Rugby Rooster.',
        '',
        `Open this sign-in link within ${PASSWORDLESS_LINK_EXPIRY_MINUTES} minutes:`,
        url,
        '',
        'If you did not request this message, you can ignore it.',
        '',
        'Signing in creates or returns you to your Rugby Rooster player account. It does not subscribe you to marketing messages.',
      ].join('\n'),
    html: (_user, url) =>
      [
        '<p>Hello from Rugby Rooster.</p>',
        `<p>Open this sign-in link within ${PASSWORDLESS_LINK_EXPIRY_MINUTES} minutes:</p>`,
        `<p><a href="${url}">Continue signing in to Rugby Rooster</a></p>`,
        '<p>If you did not request this message, you can ignore it.</p>',
        '<p>Signing in creates or returns you to your Rugby Rooster player account. It does not subscribe you to marketing messages.</p>',
      ].join(''),
  };

  accounts.sendLoginTokenEmail = async ({
    userId,
    sequence,
    email,
    extra = {},
  }) => {
    const user = (await Meteor.users.findOneAsync(userId, {
      fields: {
        emails: 1,
      },
    })) as Meteor.User | undefined;

    if (!user) {
      throwPublicDeliveryError();
    }

    const emailUser = user as Meteor.User;
    const url = accounts.urls.loginToken(email, sequence, extra);
    const emailOptions = (await accounts.generateOptionsForEmail(
      email,
      emailUser,
      url,
      'sendLoginToken',
      { sequence },
    )) as Parameters<typeof Email.sendAsync>[0];
    const replyTo = getMailReplyToAddress();
    const deliveryOptions: Parameters<typeof Email.sendAsync>[0] = {
      ...emailOptions,
      from: getMailFromAddress(),
      ...(replyTo ? { replyTo } : {}),
    };

    await Email.sendAsync(deliveryOptions);

    return {
      email,
      user: emailUser,
      url,
    };
  };
};

export const protectPasswordlessPackageMethods = () => {
  const handlers = methodHandlers();
  const originalRequestLoginTokenForUser = handlers.requestLoginTokenForUser;
  const originalLogin = handlers.login;

  if (!originalRequestLoginTokenForUser || !originalLogin) {
    throw new Error('Meteor account method handlers were not registered.');
  }

  handlers.requestLoginTokenForUser = async function requestLoginTokenForUser(
    payload: unknown,
  ) {
    const sanitizedPayload = sanitizePasswordlessRequestPayload(payload);
    const connectionIdentity = getThrottleIdentityForInvocation(this);
    const priorOwnership = await findUserOwnershipByEmail(
      sanitizedPayload.selector.email,
    );

    checkAuthThrottle(
      AUTH_THROTTLE_LIMITS.linkRequestByEmail,
      sanitizedPayload.selector.email,
    );
    checkAuthThrottle(
      AUTH_THROTTLE_LIMITS.linkRequestByAddressAggregate,
      connectionIdentity,
    );

    const isAdminDirectedRequest =
      sanitizedPayload.options.extra.returnTo === ADMIN_RETURN_PATH;

    if (
      isAdminDirectedRequest &&
      !(await isVerifiedPlatformAdminEmail(sanitizedPayload.selector.email))
    ) {
      return acknowledgePasswordlessRequest();
    }

    try {
      await originalRequestLoginTokenForUser.call(this, sanitizedPayload);
      await markUserOwnedByCurrentTestRun(
        sanitizedPayload.selector.email,
        priorOwnership,
      );
    } catch (error) {
      await markUserOwnedByCurrentTestRun(
        sanitizedPayload.selector.email,
        priorOwnership,
      );

      if (
        error instanceof Meteor.Error &&
        error.error === 'too-many-requests'
      ) {
        throw error;
      }

      logSanitizedDeliveryFailure(
        isAdminDirectedRequest ? 'admin' : 'player',
        error,
      );

      if (isAdminDirectedRequest) {
        return acknowledgePasswordlessRequest();
      }

      throwPublicDeliveryError();
    }

    return acknowledgePasswordlessRequest();
  };

  handlers.login = async function login(options: unknown) {
    const sanitizedOptions = sanitizePasswordlessLoginOptions(options);

    if (!sanitizedOptions) {
      return originalLogin.call(this, options);
    }

    const connectionIdentity = getThrottleIdentityForInvocation(this);

    checkAuthThrottle(
      AUTH_THROTTLE_LIMITS.redemptionByEmail,
      sanitizedOptions.selector.email,
    );
    checkAuthThrottle(
      AUTH_THROTTLE_LIMITS.redemptionByAddress,
      connectionIdentity,
    );

    return withProcessLock(
      `passwordless:${sanitizedOptions.selector.email}:${sanitizedOptions.token}`,
      async () => originalLogin.call(this, sanitizedOptions),
    );
  };
};
