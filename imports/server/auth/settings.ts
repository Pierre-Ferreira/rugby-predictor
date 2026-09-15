import { Meteor } from 'meteor/meteor';

import {
  type AuthRuntimeConfig,
  type AuthRuntimeEnvironment,
  type EmailDeliverySettingsInput,
  type IsolatedTestEnvironment,
  POSTMARK_PACKAGE_SETTINGS_KEY,
  type PostmarkEmailSettingsInput,
  type RugbyRoosterSettingsInput,
  validateAuthRuntimeConfig,
} from '/imports/shared/auth/config';
import { assertIsolatedMongoConnectionIdentity } from '/imports/shared/auth/testDatabaseIdentity';
import {
  getActiveMongoConnectionIdentity,
  getActiveMongoConnectionTopologyDiagnostic,
} from './mongoConnectionIdentity';

interface AdminProvisioningSettings {
  readonly action?: 'grant' | 'revoke';
  readonly email?: string;
}

interface RugbyRoosterSettings extends RugbyRoosterSettingsInput {
  readonly adminProvisioning?: AdminProvisioningSettings;
}

export const getRugbyRoosterSettings = (): RugbyRoosterSettings =>
  (Meteor.settings.private?.rugbyRooster ?? {}) as RugbyRoosterSettings;

export const getEmailDeliverySettings = (): EmailDeliverySettingsInput =>
  (Meteor.settings.email ?? {}) as EmailDeliverySettingsInput;

export const getPostmarkEmailSettings = (): PostmarkEmailSettingsInput =>
  (Meteor.settings.packages?.[POSTMARK_PACKAGE_SETTINGS_KEY] ??
    {}) as PostmarkEmailSettingsInput;

let cachedAuthRuntimeConfig: AuthRuntimeConfig | null = null;

const runtimeEnvironment = (): AuthRuntimeEnvironment => ({
  MAIL_URL: process.env.MAIL_URL,
  METEOR_LOCAL_DIR: process.env.METEOR_LOCAL_DIR,
  MONGO_OPLOG_URL: process.env.MONGO_OPLOG_URL,
  MONGO_URL: process.env.MONGO_URL,
  NODE_ENV: process.env.NODE_ENV,
  ROOT_URL: process.env.ROOT_URL,
  RUGBY_ROOSTER_TEST_DATABASE_ID: process.env.RUGBY_ROOSTER_TEST_DATABASE_ID,
  RUGBY_ROOSTER_TEST_DATABASE_NAME:
    process.env.RUGBY_ROOSTER_TEST_DATABASE_NAME,
  RUGBY_ROOSTER_TEST_MODE: process.env.RUGBY_ROOSTER_TEST_MODE,
  RUGBY_ROOSTER_TEST_MONGO_HOST: process.env.RUGBY_ROOSTER_TEST_MONGO_HOST,
  RUGBY_ROOSTER_TEST_MONGO_PORT: process.env.RUGBY_ROOSTER_TEST_MONGO_PORT,
  RUGBY_ROOSTER_TEST_RUN_ID: process.env.RUGBY_ROOSTER_TEST_RUN_ID,
});

export const validateRugbyRoosterAuthConfiguration = (): AuthRuntimeConfig => {
  cachedAuthRuntimeConfig = validateAuthRuntimeConfig({
    email: getEmailDeliverySettings(),
    env: runtimeEnvironment(),
    hasMeteorEmailPackageSettings: Boolean(Meteor.settings.packages?.email),
    isProduction: Meteor.isProduction,
    postmark: getPostmarkEmailSettings(),
    settings: getRugbyRoosterSettings(),
  });

  return cachedAuthRuntimeConfig;
};

export const getAuthRuntimeConfig = (): AuthRuntimeConfig =>
  cachedAuthRuntimeConfig ?? validateRugbyRoosterAuthConfiguration();

export const getCanonicalAppUrl = (): string =>
  getAuthRuntimeConfig().canonicalAppUrl;

export const buildCanonicalUrl = (
  pathname: string,
  params: Record<string, string>,
): string => {
  const url = new URL(pathname, `${getCanonicalAppUrl()}/`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
};

export const areTestHelpersEnabled = (): boolean => {
  return getAuthRuntimeConfig().testHelpersEnabled;
};

export const getAuthTestEnvironment = (): IsolatedTestEnvironment | null =>
  getAuthRuntimeConfig().testEnvironment;

export const getAuthTestRunId = (): string | null =>
  getAuthTestEnvironment()?.runId ?? null;

const shouldReportMongoTopologyDiagnostic = (): boolean =>
  process.env.RUGBY_ROOSTER_TEST_MONGO_DIAGNOSTICS === '1' &&
  process.env.RUGBY_ROOSTER_TEST_MODE === 'isolated';

const reportMongoTopologyDiagnostic = async (phase: string): Promise<void> => {
  if (!shouldReportMongoTopologyDiagnostic()) {
    return;
  }

  try {
    const diagnostic = await getActiveMongoConnectionTopologyDiagnostic();
    console.info(
      `[rugby-rooster:test-mongo-topology:${phase}] ${JSON.stringify(
        diagnostic,
      )}`,
    );
  } catch {
    console.info(
      `[rugby-rooster:test-mongo-topology:${phase}] ${JSON.stringify({
        diagnostic: 'unavailable',
      })}`,
    );
  }
};

export const assertVerifiedAuthTestEnvironment = async () => {
  const testEnvironment = getAuthTestEnvironment();

  if (!testEnvironment || Meteor.isProduction) {
    throw new Meteor.Error(
      'test-environment-unavailable',
      'Auth test helpers require an isolated local test environment.',
    );
  }

  try {
    const observed = await getActiveMongoConnectionIdentity();

    assertIsolatedMongoConnectionIdentity({
      expected: {
        databaseName: testEnvironment.databaseName,
        endpoint: testEnvironment.mongoEndpoint,
      },
      observed,
    });
  } catch (error) {
    await reportMongoTopologyDiagnostic('verification-failed');

    throw new Meteor.Error(
      'test-environment-mismatch',
      error instanceof Error
        ? error.message
        : 'Auth test helpers could not verify the active MongoDB connection.',
    );
  }

  return testEnvironment;
};

export const getMailFromAddress = (): string => {
  const postmarkFrom = getPostmarkEmailSettings().from?.trim();
  const rugbyRoosterFrom = getRugbyRoosterSettings().mail?.from;

  return (
    postmarkFrom ||
    rugbyRoosterFrom ||
    'Rugby Rooster <no-reply@rugbyrooster.local>'
  );
};

export const getMailReplyToAddress = (): string | undefined =>
  getPostmarkEmailSettings().supportEmail?.trim() || undefined;

export const shouldCaptureMailLocally = (): boolean => {
  return getAuthRuntimeConfig().shouldCaptureMailLocally;
};

export const getPostmarkMailSettings = () => getAuthRuntimeConfig().postmark;
