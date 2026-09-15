import { useEffect, useState } from 'react';

import {
  ADMIN_METHODS,
  type AdminAccessSummary,
} from '/imports/shared/auth/methods';
import { adminSignInPathForReturnTo } from '/imports/shared/auth/redirects';
import { useAuthState } from '../auth/useAuthState';
import { callMeteorMethod } from '../auth/methodCall';
import { SignOutButton } from '../auth/SignOutButton';
import {
  AccessDeniedState,
  SignInRequiredState,
} from '../components/AuthStates';
import { LoadingState } from '../components/Status';

export const AdminPage = () => {
  const auth = useAuthState();
  const [summaryResult, setSummaryResult] = useState<{
    readonly error?: string;
    readonly key: string;
    readonly summary?: AdminAccessSummary;
  } | null>(null);
  const summaryKey = `${auth.userId ?? 'anonymous'}:${auth.isPlatformAdmin}`;
  const activeSummary =
    summaryResult?.key === summaryKey ? summaryResult.summary : null;
  const activeError =
    summaryResult?.key === summaryKey ? summaryResult.error : null;

  useEffect(() => {
    if (auth.isLoading || !auth.isAuthenticated || !auth.isPlatformAdmin) {
      return;
    }

    let isCurrent = true;

    callMeteorMethod<AdminAccessSummary>(ADMIN_METHODS.accessSummary)
      .then((result) => {
        if (isCurrent) {
          setSummaryResult({
            key: summaryKey,
            summary: result,
          });
        }
      })
      .catch(() => {
        if (isCurrent) {
          setSummaryResult({
            error: 'The server denied access to this admin summary.',
            key: summaryKey,
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [auth.isAuthenticated, auth.isLoading, auth.isPlatformAdmin, summaryKey]);

  if (auth.isLoading) {
    return <LoadingState label="Checking admin access" />;
  }

  if (!auth.isAuthenticated) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <SignInRequiredState
          currentPath="/admin"
          message="Admin access is available only after email-link sign-in with an authorised account."
          signInPath={adminSignInPathForReturnTo('/admin')}
          title="Sign in to continue"
        />
      </main>
    );
  }

  if (!auth.isVerified || !auth.isPlatformAdmin || activeError) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <AccessDeniedState
          action={
            <SignOutButton
              className="focus-ring mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-rooster-red px-4 text-sm font-black text-white transition hover:bg-rooster-ink"
              label="Use another account"
              pendingLabel="Signing out"
              redirectTo={adminSignInPathForReturnTo('/admin')}
            />
          }
          message="Admin access is available only to authorised accounts."
          title="Admin access is restricted"
        />
      </main>
    );
  }

  if (!activeSummary) {
    return <LoadingState label="Loading admin summary" />;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <section className="rounded-lg border border-white/10 bg-white p-6 text-rooster-ink sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase text-rooster-red">
              Administration
            </p>
            <h1 className="mt-3 text-3xl font-black">Admin access summary</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-rooster-muted">
              This summary is available only to authorised admin accounts.
            </p>
          </div>
          <SignOutButton />
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-rooster-line p-4">
            <dt className="text-sm font-black text-rooster-muted">Users</dt>
            <dd className="mt-2 text-2xl font-black text-rooster-ink">
              {activeSummary.totals.users}
            </dd>
          </div>
          <div className="rounded-md border border-rooster-line p-4">
            <dt className="text-sm font-black text-rooster-muted">
              Verified players
            </dt>
            <dd className="mt-2 text-2xl font-black text-rooster-ink">
              {activeSummary.totals.verifiedEmailUsers}
            </dd>
          </div>
          <div className="rounded-md border border-rooster-line p-4 sm:col-span-2">
            <dt className="text-sm font-black text-rooster-muted">
              Passwordless package
            </dt>
            <dd className="mt-2 text-base font-bold text-rooster-ink">
              accounts-passwordless{' '}
              {activeSummary.packageVersions.accountsPasswordless}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
};
