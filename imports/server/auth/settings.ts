import { Meteor } from 'meteor/meteor';

interface MailSettings {
  readonly capture?: boolean;
  readonly from?: string;
}

interface AdminProvisioningSettings {
  readonly action?: 'grant' | 'revoke';
  readonly email?: string;
}

interface TestSettings {
  readonly enableTestHelpers?: boolean;
}

interface RugbyRoosterSettings {
  readonly adminProvisioning?: AdminProvisioningSettings;
  readonly appUrl?: string;
  readonly mail?: MailSettings;
  readonly test?: TestSettings;
}

export const getRugbyRoosterSettings = (): RugbyRoosterSettings =>
  (Meteor.settings.private?.rugbyRooster ?? {}) as RugbyRoosterSettings;

export const getCanonicalAppUrl = (): string => {
  const configuredUrl =
    getRugbyRoosterSettings().appUrl ?? process.env.ROOT_URL;

  if (!configuredUrl) {
    if (Meteor.isProduction) {
      throw new Error('Rugby Rooster requires private.rugbyRooster.appUrl.');
    }

    return 'http://127.0.0.1:3000';
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
  const settings = getRugbyRoosterSettings();

  return settings.test?.enableTestHelpers === true && !Meteor.isProduction;
};

export const getMailFromAddress = (): string =>
  getRugbyRoosterSettings().mail?.from ??
  'Rugby Rooster <no-reply@rugbyrooster.local>';

export const shouldCaptureMailLocally = (): boolean => {
  const settings = getRugbyRoosterSettings();

  if (settings.mail?.capture === true) {
    return true;
  }

  if (Meteor.isProduction) {
    return false;
  }

  return !process.env.MAIL_URL && !Meteor.settings.packages?.email;
};
