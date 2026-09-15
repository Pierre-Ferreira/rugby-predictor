import { useAuthState } from '../auth/useAuthState';
import { SignOutButton } from '../auth/SignOutButton';
import {
  AccessDeniedState,
  SignInRequiredState,
} from '../components/AuthStates';
import { LoadingState } from '../components/Status';

export const AccountPage = () => {
  const auth = useAuthState();

  if (auth.isLoading) {
    return <LoadingState label="Checking your Rugby Rooster session" />;
  }

  if (!auth.isAuthenticated) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <SignInRequiredState
          currentPath="/account"
          message="Your account page is available after you open a Rugby Rooster email sign-in link."
          title="Sign in to view your account"
        />
      </main>
    );
  }

  if (!auth.isVerified) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <AccessDeniedState
          message="Open the latest Rugby Rooster sign-in email to verify the address attached to this account."
          title="Email verification is required"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <section className="rounded-lg border border-rooster-line bg-white p-6 sm:p-8">
        <p className="text-sm font-black uppercase text-rooster-red">
          Player account
        </p>
        <h1 className="mt-3 text-3xl font-black text-rooster-ink">
          Your Rugby Rooster account
        </h1>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-rooster-line p-4">
            <dt className="text-sm font-black text-rooster-muted">Email</dt>
            <dd className="mt-2 break-words text-base font-bold text-rooster-ink">
              {auth.primaryEmail?.address}
            </dd>
          </div>
          <div className="rounded-md border border-rooster-line p-4">
            <dt className="text-sm font-black text-rooster-muted">Status</dt>
            <dd className="mt-2 text-base font-bold text-rooster-ink">
              Verified player
            </dd>
          </div>
        </dl>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
};
