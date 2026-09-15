import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { PASSWORDLESS_LINK_EXPIRY_MINUTES } from '/imports/shared/auth/constants';
import {
  AUTH_METHODS,
  type RequestSignInLinkResult,
} from '/imports/shared/auth/methods';
import { resolveSafeReturnPath } from '/imports/shared/auth/redirects';
import { validateEmailIdentity } from '/imports/shared/auth/email';
import { useAuthState } from '../auth/useAuthState';
import { callMeteorMethod } from '../auth/methodCall';
import { AppLink } from '../components/AppLink';

const getReturnToFromLocation = () => {
  const params = new URLSearchParams(window.location.search);

  return resolveSafeReturnPath(params.get('returnTo'));
};

const getSignInModeFromLocation = () => {
  const params = new URLSearchParams(window.location.search);
  const returnTo = getReturnToFromLocation();
  const isAdminMode = params.get('mode') === 'admin' || returnTo === '/admin';

  return {
    isAdminMode,
    returnTo: isAdminMode ? '/admin' : returnTo,
  };
};

export const SignInPage = () => {
  const auth = useAuthState();
  const { isAdminMode, returnTo } = useMemo(
    () => getSignInModeFromLocation(),
    [],
  );
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!cooldownUntil) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  const remainingCooldownSeconds = Math.max(
    0,
    Math.ceil((cooldownUntil - now) / 1000),
  );
  const isCoolingDown = remainingCooldownSeconds > 0;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validation = validateEmailIdentity(email);

    if (!validation.isValid) {
      setError(validation.reason ?? 'Enter a valid email address.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const methodName = isAdminMode
        ? AUTH_METHODS.requestAdminSignInLink
        : AUTH_METHODS.requestSignInLink;
      const requestInput = isAdminMode
        ? { email: validation.email }
        : {
            email: validation.email,
            returnTo,
          };

      await callMeteorMethod<RequestSignInLinkResult>(methodName, requestInput);
      setSentEmail(validation.email);
      const nextNow = Date.now();
      setNow(nextNow);
      setCooldownUntil(nextNow + 30_000);
    } catch (requestError) {
      const reason =
        requestError instanceof Error
          ? requestError.message
          : 'We could not send a sign-in link right now.';
      setError(reason);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="rounded-lg border border-rooster-line bg-white p-6 sm:p-8">
          <p className="text-sm font-black uppercase text-rooster-red">
            {isAdminMode ? 'Admin access' : 'Player access'}
          </p>
          <h1 className="mt-3 text-3xl font-black text-rooster-ink">
            {isAdminMode
              ? 'Sign in to Rugby Rooster Admin'
              : 'Sign in to Rugby Rooster'}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-rooster-muted">
            {isAdminMode
              ? 'Enter the email address for an existing verified platform-admin account.'
              : 'Enter your email address and Rugby Rooster will send one secure sign-in link for this browser or another one.'}
          </p>

          {auth.isAuthenticated && auth.isVerified ? (
            <div
              className="mt-6 rounded-md border border-rooster-grass/30 bg-rooster-grass/10 p-4"
              role="status"
            >
              <p className="font-bold text-rooster-ink">
                You are already signed in.
              </p>
              <AppLink
                className="focus-ring mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-rooster-ink px-4 text-sm font-black text-white transition hover:bg-rooster-red"
                to={returnTo}
              >
                Continue
              </AppLink>
            </div>
          ) : (
            <form className="mt-6 max-w-xl" onSubmit={submit}>
              <label
                className="text-sm font-black text-rooster-ink"
                htmlFor="email"
              >
                Email address
              </label>
              <input
                autoComplete="email"
                className="focus-ring mt-2 block min-h-12 w-full rounded-md border border-rooster-line bg-white px-3 text-base text-rooster-ink"
                id="email"
                inputMode="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />

              <button
                className="focus-ring mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-rooster-red px-5 text-base font-black text-white transition hover:bg-rooster-ink disabled:cursor-not-allowed disabled:bg-rooster-muted sm:w-auto"
                disabled={isSubmitting || isCoolingDown}
                type="submit"
              >
                {isSubmitting
                  ? 'Sending link'
                  : isCoolingDown
                    ? `Retry in ${remainingCooldownSeconds}s`
                    : isAdminMode
                      ? 'Email me an admin sign-in link'
                      : 'Email me a sign-in link'}
              </button>
            </form>
          )}

          {sentEmail ? (
            <div
              className="mt-6 rounded-md border border-rooster-grass/30 bg-rooster-grass/10 p-4"
              role="status"
            >
              <p className="font-bold text-rooster-ink">
                {isAdminMode
                  ? 'If this account is eligible for admin access, we’ve sent a sign-in link.'
                  : 'Check your email for a Rugby Rooster sign-in link.'}
              </p>
              <p className="mt-2 text-sm leading-6 text-rooster-muted">
                The link expires in {PASSWORDLESS_LINK_EXPIRY_MINUTES} minutes.
                {isAdminMode
                  ? ' This acknowledgement is the same for eligible and ineligible addresses.'
                  : ' This acknowledgement is the same for new and returning players.'}
              </p>
            </div>
          ) : null}

          {error ? (
            <div
              className="mt-6 rounded-md border border-rooster-red/30 bg-rooster-red/10 p-4 text-sm font-semibold text-rooster-ink"
              role="alert"
            >
              {error}
            </div>
          ) : null}
        </div>

        <aside className="rounded-lg border border-rooster-line bg-white p-5">
          <h2 className="text-base font-black text-rooster-ink">
            One email, one account
          </h2>
          <p className="mt-3 text-sm leading-6 text-rooster-muted">
            {isAdminMode
              ? 'Admin access still depends on the server-side platform-admin grant at the moment protected data is requested.'
              : 'This access email is separate from future optional marketing preferences.'}
          </p>
        </aside>
      </section>
    </main>
  );
};
