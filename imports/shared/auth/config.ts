import {
  type MongoConnectionEndpoint,
  resolveExpectedMongoConnectionIdentity,
} from './testDatabaseIdentity';

export interface MailSettingsInput {
  readonly capture?: boolean;
  readonly from?: string;
}

export interface EmailDeliverySettingsInput {
  readonly enabled?: boolean;
}

export interface PostmarkEmailSettingsInput {
  readonly apiToken?: string;
  readonly from?: string;
  readonly supportEmail?: string;
}

export interface ResolvedPostmarkEmailSettings {
  readonly apiToken: string;
  readonly from: string;
  readonly supportEmail?: string;
}

export interface TestSettingsInput {
  readonly enableTestHelpers?: boolean;
}

export interface ThrottleRuleSettingsInput {
  readonly limit?: number;
  readonly windowMinutes?: number;
}

export interface AuthThrottleSettingsInput {
  readonly linkRequestByAddressAggregate?: ThrottleRuleSettingsInput;
  readonly linkRequestByEmail?: ThrottleRuleSettingsInput;
  readonly redemptionByAddress?: ThrottleRuleSettingsInput;
  readonly redemptionByEmail?: ThrottleRuleSettingsInput;
}

export interface RugbyRoosterSettingsInput {
  readonly appUrl?: string;
  readonly mail?: MailSettingsInput;
  readonly test?: TestSettingsInput;
  readonly throttle?: AuthThrottleSettingsInput;
}

export interface AuthRuntimeEnvironment {
  readonly MAIL_URL?: string;
  readonly METEOR_LOCAL_DIR?: string;
  readonly MONGO_OPLOG_URL?: string;
  readonly MONGO_URL?: string;
  readonly NODE_ENV?: string;
  readonly ROOT_URL?: string;
  readonly RUGBY_ROOSTER_TEST_DATABASE_ID?: string;
  readonly RUGBY_ROOSTER_TEST_DATABASE_NAME?: string;
  readonly RUGBY_ROOSTER_TEST_MODE?: string;
  readonly RUGBY_ROOSTER_TEST_MONGO_HOST?: string;
  readonly RUGBY_ROOSTER_TEST_MONGO_PORT?: string;
  readonly RUGBY_ROOSTER_TEST_RUN_ID?: string;
}

export interface AuthRuntimeConfigInput {
  readonly email?: EmailDeliverySettingsInput;
  readonly env?: AuthRuntimeEnvironment;
  readonly hasMeteorEmailPackageSettings?: boolean;
  readonly isProduction: boolean;
  readonly postmark?: PostmarkEmailSettingsInput;
  readonly settings?: RugbyRoosterSettingsInput;
}

export interface IsolatedTestEnvironment {
  readonly appUrl: string;
  readonly databaseId: string;
  readonly databaseName: string;
  readonly localDir: string;
  readonly mongoEndpoint: MongoConnectionEndpoint;
  readonly runId: string;
}

export interface AuthRuntimeConfig {
  readonly canonicalAppUrl: string;
  readonly mailDeliveryMode: 'capture' | 'transport';
  readonly mailTransportProvider: 'meteor' | 'postmark' | null;
  readonly postmark: ResolvedPostmarkEmailSettings | null;
  readonly shouldCaptureMailLocally: boolean;
  readonly testEnvironment: IsolatedTestEnvironment | null;
  readonly testHelpersEnabled: boolean;
}

export interface AuthThrottleLimits {
  readonly linkRequestByAddressAggregate: ResolvedThrottleRule;
  readonly linkRequestByEmail: ResolvedThrottleRule;
  readonly redemptionByAddress: ResolvedThrottleRule;
  readonly redemptionByEmail: ResolvedThrottleRule;
}

export interface ResolvedThrottleRule {
  readonly keyPrefix: string;
  readonly limit: number;
  readonly windowMs: number;
}

const FALLBACK_APP_URL = 'http://127.0.0.1:3000';
export const POSTMARK_PACKAGE_SETTINGS_KEY = 'quave:email-postmark';
const TEST_MODE = 'isolated';
const TEST_DATABASE_NAME = 'meteor';
const TEST_RUN_ID_PATTERN = /^rr-(integration|e2e)-[a-zA-Z0-9_.:-]{6,80}$/;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const MINUTE_MS = 60 * 1000;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTMARK_PLACEHOLDER_TOKENS = new Set([
  'POSTMARK_API_TEST',
  'POSTMARK_API_TOKEN',
  'REPLACE_LOCALLY',
  'REPLACE_ME',
  'SERVER_TOKEN',
  'YOUR_POSTMARK_API_TOKEN',
]);

const DEFAULT_THROTTLE_LIMITS: AuthThrottleLimits = {
  linkRequestByAddressAggregate: {
    keyPrefix: 'link-address-aggregate',
    limit: 40,
    windowMs: 15 * MINUTE_MS,
  },
  linkRequestByEmail: {
    keyPrefix: 'link-email',
    limit: 3,
    windowMs: 15 * MINUTE_MS,
  },
  redemptionByAddress: {
    keyPrefix: 'redeem-address',
    limit: 40,
    windowMs: 15 * MINUTE_MS,
  },
  redemptionByEmail: {
    keyPrefix: 'redeem-email',
    limit: 8,
    windowMs: 15 * MINUTE_MS,
  },
} as const;

export const buildMeteorManagedTestDatabaseId = (localDir: string): string =>
  `meteor-managed:${localDir}:db`;

const canonicalizeAppUrl = (
  value: string | undefined,
  isProduction: boolean,
): string => {
  const configuredUrl = value?.trim();

  if (!configuredUrl) {
    if (isProduction) {
      throw new Error('Rugby Rooster requires private.rugbyRooster.appUrl.');
    }

    return FALLBACK_APP_URL;
  }

  let parsed: URL;

  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new Error('private.rugbyRooster.appUrl must be an absolute URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('private.rugbyRooster.appUrl must use http or https.');
  }

  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');

  return parsed.toString().replace(/\/$/, '');
};

const hasMeteorMailTransport = (
  env: AuthRuntimeEnvironment,
  hasMeteorEmailPackageSettings: boolean,
): boolean => Boolean(env.MAIL_URL) || hasMeteorEmailPackageSettings;

const cleanOptionalString = (value: string | undefined): string | undefined => {
  const cleanedValue = value?.trim();

  return cleanedValue || undefined;
};

export const isPlaceholderPostmarkApiToken = (
  value: string | undefined,
): boolean => {
  const apiToken = cleanOptionalString(value);

  return (
    !apiToken ||
    POSTMARK_PLACEHOLDER_TOKENS.has(apiToken.toUpperCase()) ||
    /^REPLACE[_-]/i.test(apiToken)
  );
};

export const resolvePostmarkEmailSettings = (
  settings: PostmarkEmailSettingsInput | undefined,
): ResolvedPostmarkEmailSettings => {
  if (isPlaceholderPostmarkApiToken(settings?.apiToken)) {
    throw new Error(
      `Postmark email delivery requires Meteor.settings.packages["${POSTMARK_PACKAGE_SETTINGS_KEY}"].apiToken to contain a real server token.`,
    );
  }

  const from = cleanOptionalString(settings?.from);

  if (!from) {
    throw new Error(
      `Postmark email delivery requires Meteor.settings.packages["${POSTMARK_PACKAGE_SETTINGS_KEY}"].from.`,
    );
  }

  const supportEmail = cleanOptionalString(settings?.supportEmail);

  if (supportEmail && !EMAIL_ADDRESS_PATTERN.test(supportEmail)) {
    throw new Error(
      `Meteor.settings.packages["${POSTMARK_PACKAGE_SETTINGS_KEY}"].supportEmail must be an email address.`,
    );
  }

  return {
    apiToken: cleanOptionalString(settings?.apiToken) as string,
    from,
    supportEmail,
  };
};

const assertLoopbackUrl = (value: string, label: string) => {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute loopback URL.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} must use http or https.`);
  }

  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`${label} must target a loopback host for auth tests.`);
  }
};

const resolveIsolatedTestEnvironment = (
  env: AuthRuntimeEnvironment,
  canonicalAppUrl: string,
): IsolatedTestEnvironment => {
  if (env.RUGBY_ROOSTER_TEST_MODE !== TEST_MODE) {
    throw new Error(
      'Auth test helpers require RUGBY_ROOSTER_TEST_MODE=isolated.',
    );
  }

  const runId = env.RUGBY_ROOSTER_TEST_RUN_ID;

  if (!runId || !TEST_RUN_ID_PATTERN.test(runId)) {
    throw new Error(
      'Auth test helpers require a valid RUGBY_ROOSTER_TEST_RUN_ID.',
    );
  }

  const localDir = env.METEOR_LOCAL_DIR;

  if (!localDir) {
    throw new Error('Auth test helpers require METEOR_LOCAL_DIR.');
  }

  const expectedDatabaseId = buildMeteorManagedTestDatabaseId(localDir);

  if (env.RUGBY_ROOSTER_TEST_DATABASE_ID !== expectedDatabaseId) {
    throw new Error(
      'Auth test helpers require the expected test database identity.',
    );
  }

  const databaseName = env.RUGBY_ROOSTER_TEST_DATABASE_NAME;

  if (databaseName !== TEST_DATABASE_NAME) {
    throw new Error(
      `Auth test helpers require the Meteor-managed "${TEST_DATABASE_NAME}" database.`,
    );
  }

  const expectedMongoIdentity = resolveExpectedMongoConnectionIdentity({
    databaseName,
    host: env.RUGBY_ROOSTER_TEST_MONGO_HOST,
    port: env.RUGBY_ROOSTER_TEST_MONGO_PORT,
  });

  assertLoopbackUrl(canonicalAppUrl, 'private.rugbyRooster.appUrl');

  if (env.ROOT_URL) {
    assertLoopbackUrl(env.ROOT_URL, 'ROOT_URL');
  }

  return {
    appUrl: canonicalAppUrl,
    databaseId: expectedDatabaseId,
    databaseName,
    localDir,
    mongoEndpoint: expectedMongoIdentity.endpoint,
    runId,
  };
};

const resolveThrottleRule = (
  defaults: ResolvedThrottleRule,
  settings: ThrottleRuleSettingsInput | undefined,
): ResolvedThrottleRule => {
  const limit = settings?.limit ?? defaults.limit;
  const windowMinutes =
    settings?.windowMinutes ?? defaults.windowMs / MINUTE_MS;
  const windowMs = Number.isFinite(windowMinutes)
    ? Math.round(windowMinutes * MINUTE_MS)
    : Number.NaN;

  if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) {
    throw new Error(
      `Invalid auth throttle limit for ${defaults.keyPrefix}. Use an integer from 1 to 10000.`,
    );
  }

  if (
    !Number.isFinite(windowMinutes) ||
    windowMinutes < 1 ||
    windowMinutes > 24 * 60 ||
    windowMs < 1
  ) {
    throw new Error(
      `Invalid auth throttle window for ${defaults.keyPrefix}. Use minutes from 1 to 1440.`,
    );
  }

  return {
    keyPrefix: defaults.keyPrefix,
    limit,
    windowMs,
  };
};

export const resolveAuthThrottleLimits = (
  settings: RugbyRoosterSettingsInput = {},
): AuthThrottleLimits => ({
  linkRequestByAddressAggregate: resolveThrottleRule(
    DEFAULT_THROTTLE_LIMITS.linkRequestByAddressAggregate,
    settings.throttle?.linkRequestByAddressAggregate,
  ),
  linkRequestByEmail: resolveThrottleRule(
    DEFAULT_THROTTLE_LIMITS.linkRequestByEmail,
    settings.throttle?.linkRequestByEmail,
  ),
  redemptionByAddress: resolveThrottleRule(
    DEFAULT_THROTTLE_LIMITS.redemptionByAddress,
    settings.throttle?.redemptionByAddress,
  ),
  redemptionByEmail: resolveThrottleRule(
    DEFAULT_THROTTLE_LIMITS.redemptionByEmail,
    settings.throttle?.redemptionByEmail,
  ),
});

export const validateAuthRuntimeConfig = ({
  email = {},
  env = {},
  hasMeteorEmailPackageSettings = false,
  isProduction,
  postmark,
  settings = {},
}: AuthRuntimeConfigInput): AuthRuntimeConfig => {
  const canonicalAppUrl = canonicalizeAppUrl(
    settings.appUrl ?? env.ROOT_URL,
    isProduction,
  );
  const explicitCapture = settings.mail?.capture === true;
  const meteorTransportConfigured = hasMeteorMailTransport(
    env,
    hasMeteorEmailPackageSettings,
  );

  if (isProduction && explicitCapture) {
    throw new Error(
      'Production cannot use private.rugbyRooster.mail.capture. Disable capture and configure MAIL_URL or Meteor email package settings.',
    );
  }

  if (isProduction && settings.test?.enableTestHelpers === true) {
    throw new Error(
      'Production cannot enable private.rugbyRooster.test.enableTestHelpers.',
    );
  }

  const testEnvironment =
    settings.test?.enableTestHelpers === true
      ? resolveIsolatedTestEnvironment(env, canonicalAppUrl)
      : null;
  const shouldForceLocalCapture = explicitCapture || Boolean(testEnvironment);
  let mailTransportProvider: AuthRuntimeConfig['mailTransportProvider'] = null;
  let postmarkSettings: ResolvedPostmarkEmailSettings | null = null;
  let shouldCaptureMailLocally = shouldForceLocalCapture;

  if (!shouldForceLocalCapture && email.enabled === false) {
    if (isProduction) {
      throw new Error(
        'Production passwordless email delivery cannot be disabled.',
      );
    }

    shouldCaptureMailLocally = true;
  }

  if (!shouldCaptureMailLocally && email.enabled === true) {
    if (meteorTransportConfigured) {
      throw new Error(
        'Postmark email delivery cannot be combined with MAIL_URL or Meteor.settings.packages.email.',
      );
    }

    postmarkSettings = resolvePostmarkEmailSettings(postmark);
    mailTransportProvider = 'postmark';
  }

  if (
    !shouldCaptureMailLocally &&
    !mailTransportProvider &&
    meteorTransportConfigured
  ) {
    mailTransportProvider = 'meteor';
  }

  if (!shouldCaptureMailLocally && !mailTransportProvider) {
    if (isProduction) {
      throw new Error(
        'Production mail delivery requires MAIL_URL, Meteor.settings.packages.email, or enabled Postmark settings.',
      );
    }

    shouldCaptureMailLocally = true;
  }

  resolveAuthThrottleLimits(settings);

  return {
    canonicalAppUrl,
    mailDeliveryMode: shouldCaptureMailLocally ? 'capture' : 'transport',
    mailTransportProvider,
    postmark: postmarkSettings,
    shouldCaptureMailLocally,
    testEnvironment,
    testHelpersEnabled: Boolean(testEnvironment),
  };
};
