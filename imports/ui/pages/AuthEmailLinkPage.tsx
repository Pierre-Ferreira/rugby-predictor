import { useEffect, useState } from 'react';
import { Meteor } from 'meteor/meteor';

import {
  PASSWORDLESS_TOKEN_SEQUENCE_LENGTH,
} from '/imports/shared/auth/constants';
import {
  resolveSafeReturnPath,
  signInPathForReturnTo,
} from '/imports/shared/auth/redirects';
import {
  normalizeEmailIdentity,
  validateEmailIdentity,
} from '/imports/shared/auth/email';
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
    record.token.length > 0 &&
    record.token.length <= PASSWORDLESS_TOKEN_SEQUENCE_LENGTH
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
  const hasLinkCredentials = params.has('email') || params.has('token');
  const emailValidation = validateEmailIdentity(params.get('email'));
  const token = params.get('token');

  if (!hasLinkCredentials) {
    return pendingLinkCredentials ?? readStoredCredentials();
  }

  if (
    !emailValidation.isValid ||
    !token ||
    token.length > PASSWORDLESS_TOKEN_SEQUENCE_LENGTH
  ) {
    clearPendingCredentials();
    return null;
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

const logoutCurrentSession = (): Promise<void> =>
  new Promise((resolve, reject) => {
    Meteor.logout((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

export const AuthEmailLinkPage = () => {
  const auth = useAuthState();
  const [credentials, setCredentials] = useState(readCredentialsFromLocation);
  const returnTo = credentials?.returnTo ?? getReturnToFromLocation();
  const [error, setError] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const currentEmail = auth.primaryEmail?.address
    ? normalizeEmailIdentity(auth.primaryEmail.address)
    : null;
  const linkEmail = credentials?.email ?? null;
  const isVerifiedSession =
    auth.isAuthenticated && auth.isVerified && Boolean(currentEmail);
  const isSameAccount =
    isVerifiedSession && Boolean(linkEmail) && currentEmail === linkEmail;
  const isDifferentAccount =
    isVerifiedSession && Boolean(linkEmail) && currentEmail !== linkEmail;

  useEffect(() => {
    window.history.replaceState(
      {},
      '',
      `/auth/email-link?returnTo=${encodeURIComponent(returnTo)}`,
    );
  }, [returnTo]);

  const discardCredentials = () => {
    clearPendingCredentials();
    setCredentials(null);
  };

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
      setCredentials(null);
    } catch {
      discardCredentials();
      setError('This sign-in link is invalid, expired, or already used.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const continueWithCurrentSession = () => {
    clearPendingCredentials();
    navigateTo(returnTo, true);
    setCredentials(null);
  };

  const switchAccounts = async () => {
    if (!credentials) {
      return;
    }

    setError(null);
    setIsRedeeming(true);

    try {
      await logoutCurrentSession();
      await loginWithPasswordlessToken(credentials);
      clearPendingCredentials();
      navigateTo(credentials.returnTo, true);
      setCredentials(null);
    } catch {
      discardCredentials();
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

        {error ? (
          <div
            className="mt-6 rounded-md border border-rooster-red/30 bg-rooster-red/10 p-4"
            role="alert"
          >
            <p className="font-bold text-rooster-ink">{error}</p>
            <AppLink
              className="focus-ring mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-black text-rooster-red transition hover:bg-rooster-sun"
              to={signInPathForReturnTo(returnTo)}
            >
              Request another link
            </AppLink>
          </div>
        ) : auth.isLoading ? (
          <div
            className="mt-6 flex min-h-16 items-center rounded-md border border-rooster-line bg-rooster-paper px-4"
            role="status"
          >
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-rooster-line border-t-rooster-red" />
            <span className="ml-3 text-sm font-semibold text-rooster-muted">
              Checking your Rugby Rooster session
            </span>
          </div>
        ) : credentials && isSameAccount ? (
          <div
            className="mt-6 rounded-md border border-rooster-grass/30 bg-rooster-grass/10 p-4"
            role="status"
          >
            <p className="font-bold text-rooster-ink">
              You are already signed in as {currentEmail}.
            </p>
            <p className="mt-2 text-sm leading-6 text-rooster-muted">
              This link is intended for the same account.
            </p>
            <button
              className="focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-rooster-red px-4 text-sm font-black text-white transition hover:bg-rooster-ink sm:w-auto"
              onClick={continueWithCurrentSession}
              type="button"
            >
              Continue with current session
            </button>
          </div>
        ) : credentials && isDifferentAccount ? (
          <div
            className="mt-6 rounded-md border border-rooster-red/30 bg-rooster-red/10 p-4"
            role="status"
          >
            <p className="font-bold text-rooster-ink">
              You are signed in as {currentEmail}.
            </p>
            <p className="mt-2 text-sm leading-6 text-rooster-muted">
              This link is intended for {linkEmail}.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                className="focus-ring inline-flex min-h-11 w-full items-center justify-center rounded-md bg-rooster-red px-4 text-sm font-black text-white transition hover:bg-rooster-ink disabled:cursor-not-allowed disabled:bg-rooster-muted sm:w-auto"
                disabled={isRedeeming}
                onClick={switchAccounts}
                type="button"
              >
                {isRedeeming ? 'Switching accounts' : 'Switch accounts'}
              </button>
              <button
                className="focus-ring inline-flex min-h-11 w-full items-center justify-center rounded-md border border-rooster-line bg-white px-4 text-sm font-black text-rooster-ink transition hover:bg-rooster-sun disabled:cursor-not-allowed disabled:text-rooster-muted sm:w-auto"
                disabled={isRedeeming}
                onClick={continueWithCurrentSession}
                type="button"
              >
                Keep current account
              </button>
            </div>
          </div>
        ) : credentials ? (
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
      </section>
    </main>
  );
};
