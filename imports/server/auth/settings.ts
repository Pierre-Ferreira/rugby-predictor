import { Meteor } from 'meteor/meteor';
import { MongoInternals } from 'meteor/mongo';

import {
  type AuthRuntimeConfig,
  type AuthRuntimeEnvironment,
  type IsolatedTestEnvironment,
  type RugbyRoosterSettingsInput,
  validateAuthRuntimeConfig,
} from '/imports/shared/auth/config';

interface AdminProvisioningSettings {
  readonly action?: 'grant' | 'revoke';
  readonly email?: string;
}

interface RugbyRoosterSettings extends RugbyRoosterSettingsInput {
  readonly adminProvisioning?: AdminProvisioningSettings;
}

export const getRugbyRoosterSettings = (): RugbyRoosterSettings =>
  (Meteor.settings.private?.rugbyRooster ?? {}) as RugbyRoosterSettings;

let cachedAuthRuntimeConfig: AuthRuntimeConfig | null = null;

const runtimeEnvironment = (): AuthRuntimeEnvironment => ({
  MAIL_URL: process.env.MAIL_URL,
  METEOR_LOCAL_DIR: process.env.METEOR_LOCAL_DIR,
  MONGO_OPLOG_URL: process.env.MONGO_OPLOG_URL,
  MONGO_URL: process.env.MONGO_URL,
  NODE_ENV: process.env.NODE_ENV,
  ROOT_URL: process.env.ROOT_URL,
  RUGBY_ROOSTER_TEST_DATABASE_ID:
    process.env.RUGBY_ROOSTER_TEST_DATABASE_ID,
  RUGBY_ROOSTER_TEST_DATABASE_NAME:
    process.env.RUGBY_ROOSTER_TEST_DATABASE_NAME,
  RUGBY_ROOSTER_TEST_MODE: process.env.RUGBY_ROOSTER_TEST_MODE,
  RUGBY_ROOSTER_TEST_RUN_ID: process.env.RUGBY_ROOSTER_TEST_RUN_ID,
});

export const validateRugbyRoosterAuthConfiguration =
  (): AuthRuntimeConfig => {
    cachedAuthRuntimeConfig = validateAuthRuntimeConfig({
      env: runtimeEnvironment(),
      hasMeteorEmailPackageSettings: Boolean(Meteor.settings.packages?.email),
      isProduction: Meteor.isProduction,
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

export const getActiveMongoDatabaseName = (): string | null => {
  const driver = MongoInternals.defaultRemoteCollectionDriver() as unknown as {
    mongo?: {
      db?: {
        databaseName?: string;
        s?: {
          databaseName?: string;
          namespace?: {
            db?: string;
          };
        };
      };
    };
  };
  const db = driver.mongo?.db;

  return (
    db?.databaseName ??
    db?.s?.databaseName ??
    db?.s?.namespace?.db ??
    null
  );
};

export const assertVerifiedAuthTestEnvironment = () => {
  const testEnvironment = getAuthTestEnvironment();

  if (!testEnvironment || Meteor.isProduction) {
    throw new Meteor.Error(
      'test-environment-unavailable',
      'Auth test helpers require an isolated local test environment.',
    );
  }

  const activeDatabaseName = getActiveMongoDatabaseName();

  if (activeDatabaseName !== testEnvironment.databaseName) {
    throw new Meteor.Error(
      'test-environment-mismatch',
      'Auth test helpers refused to run against the active database.',
    );
  }

  return testEnvironment;
};

export const getMailFromAddress = (): string =>
  getRugbyRoosterSettings().mail?.from ??
  'Rugby Rooster <no-reply@rugbyrooster.local>';

export const shouldCaptureMailLocally = (): boolean => {
  return getAuthRuntimeConfig().shouldCaptureMailLocally;
};
