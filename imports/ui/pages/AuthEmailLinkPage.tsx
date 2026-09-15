import { useEffect, useState } from 'react';
import { Meteor } from 'meteor/meteor';

import {
  resolveSafeReturnPath,
  signInPathForReturnTo,
} from '/imports/shared/auth/redirects';
import { validateEmailIdentity } from '/imports/shared/auth/email';
import { navigateTo } from '../navigation';
import { AppLink } from '../components/AppLink';
import { useAuthState } from '../auth/useAuthState';

interface LinkCredentials {
  readonly email: string;
  readonly returnTo: string;
  readonly token: string;
}

let pendingLinkCredentials: LinkCredentials | null = null;
const PENDING_LINK_STORAGE_KEY = 'rugby-rooster:pending-email-link';

const isLinkCredentials = (value: unknown): value is LinkCredentials => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Partial<LinkCredentials>;
  const emailValidation = validateEmailIdentity(record.email);

  return (
    emailValidation.isValid &&
    emailValidation.email === record.email &&
    resolveSafeReturnPath(record.returnTo) === record.returnTo &&
    typeof record.token === 'string' &&
    record.token.length > 0
  );
};

const readStoredCredentials = (): LinkCredentials | null => {
  try {
    const storedValue = window.sessionStorage.getItem(PENDING_LINK_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as unknown;

    return isLinkCredentials(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
};

const storePendingCredentials = (credentials: LinkCredentials) => {
  pendingLinkCredentials = credentials;

  try {
    window.sessionStorage.setItem(
      PENDING_LINK_STORAGE_KEY,
      JSON.stringify(credentials),
    );
  } catch {
    // In-memory credentials still support browsers that block sessionStorage.
  }
};

const clearPendingCredentials = () => {
  pendingLinkCredentials = null;

  try {
    window.sessionStorage.removeItem(PENDING_LINK_STORAGE_KEY);
  } catch {
    // Nothing else to clear when storage is unavailable.
  }
};

const getReturnToFromLocation = (): string => {
  const params = new URLSearchParams(window.location.search);

  return resolveSafeReturnPath(params.get('returnTo'));
};

const readCredentialsFromLocation = (): LinkCredentials | null => {
  const params = new URLSearchParams(window.location.search);
  const emailValidation = validateEmailIdentity(params.get('email'));
  const token = params.get('token');

  if (!emailValidation.isValid || !token) {
    return pendingLinkCredentials ?? readStoredCredentials();
  }

  const credentials = {
    email: emailValidation.email,
    returnTo: resolveSafeReturnPath(params.get('returnTo')),
    token,
  };

  storePendingCredentials(credentials);

  return credentials;
};

const loginWithPasswordlessToken = (
  credentials: LinkCredentials,
): Promise<void> =>
  new Promise((resolve, reject) => {
    Meteor.passwordlessLoginWithToken(
      { email: credentials.email },
      credentials.token,
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      },
    );
  });

export const AuthEmailLinkPage = () => {
  const auth = useAuthState();
  const [credentials] = useState(readCredentialsFromLocation);
  const returnTo = credentials?.returnTo ?? getReturnToFromLocation();
  const [error, setError] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  useEffect(() => {
    window.history.replaceState(
      {},
      '',
      `/auth/email-link?returnTo=${encodeURIComponent(returnTo)}`,
    );
  }, [returnTo]);

  useEffect(() => {
    if (auth.isLoading || !auth.isAuthenticated || !auth.isVerified) {
      return;
    }

    clearPendingCredentials();
    navigateTo(returnTo, true);
  }, [auth.isAuthenticated, auth.isLoading, auth.isVerified, returnTo]);

  const continueSigningIn = async () => {
    if (!credentials) {
      return;
    }

    setError(null);
    setIsRedeeming(true);

    try {
      await loginWithPasswordlessToken(credentials);
      clearPendingCredentials();
      navigateTo(credentials.returnTo, true);
    } catch {
      clearPendingCredentials();
      setError('This sign-in link is invalid, expired, or already used.');
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <section className="rounded-lg border border-rooster-line bg-white p-6 sm:p-8">
        <p className="text-sm font-black uppercase text-rooster-red">
          Email link
        </p>
        <h1 className="mt-3 text-3xl font-black text-rooster-ink">
          Continue signing in
        </h1>
        <p className="mt-4 text-base leading-7 text-rooster-muted">
          Confirm this browser should use the Rugby Rooster sign-in link.
        </p>

        {credentials ? (
          <button
            className="focus-ring mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-rooster-red px-5 text-base font-black text-white transition hover:bg-rooster-ink disabled:cursor-not-allowed disabled:bg-rooster-muted sm:w-auto"
            disabled={isRedeeming}
            onClick={continueSigningIn}
            type="button"
          >
            {isRedeeming ? 'Checking link' : 'Continue signing in'}
          </button>
        ) : (
          <div
            className="mt-6 rounded-md border border-rooster-red/30 bg-rooster-red/10 p-4"
            role="alert"
          >
            <p className="font-bold text-rooster-ink">
              This sign-in link is missing details.
            </p>
            <AppLink
              className="focus-ring mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-rooster-red px-4 text-sm font-black text-white transition hover:bg-rooster-ink"
              to="/sign-in"
            >
              Request a new link
            </AppLink>
          </div>
        )}

        {error ? (
          <div
            className="mt-6 rounded-md border border-rooster-red/30 bg-rooster-red/10 p-4"
            role="alert"
          >
            <p className="font-bold text-rooster-ink">{error}</p>
            <AppLink
              className="focus-ring mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-black text-rooster-red transition hover:bg-rooster-sun"
              to={signInPathForReturnTo(credentials?.returnTo ?? '/games')}
            >
              Request another link
            </AppLink>
          </div>
        ) : null}
      </section>
    </main>
  );
};
