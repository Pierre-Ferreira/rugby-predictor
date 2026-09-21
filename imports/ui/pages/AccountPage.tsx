import { type FormEvent, useEffect, useState } from 'react';

import {
  PLAYER_PROFILE_METHODS,
  type PublicPlayerIdentity,
} from '/imports/shared/playerProfiles';
import { useAuthState } from '../auth/useAuthState';
import { SignOutButton } from '../auth/SignOutButton';
import { callMeteorMethod } from '../auth/methodCall';
import {
  AccessDeniedState,
  SignInRequiredState,
} from '../components/AuthStates';
import { LoadingState } from '../components/Status';

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const message = (error as { readonly message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }
  }

  return 'The public player name could not be saved.';
};

export const AccountPage = () => {
  const auth = useAuthState();
  const [displayName, setDisplayName] = useState('');
  const [loadedProfileUserId, setLoadedProfileUserId] = useState<string | null>(
    null,
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSavedMessage, setProfileSavedMessage] = useState<string | null>(
    null,
  );
  const isVerifiedAccountReady =
    !auth.isLoading && auth.isAuthenticated && auth.isVerified && auth.userId;
  const isProfileLoading =
    Boolean(isVerifiedAccountReady) && loadedProfileUserId !== auth.userId;
  const activeProfileError =
    loadedProfileUserId === auth.userId ? profileError : null;
  const activeProfileSavedMessage =
    loadedProfileUserId === auth.userId ? profileSavedMessage : null;

  useEffect(() => {
    if (!isVerifiedAccountReady) {
      return;
    }

    let isActive = true;

    void callMeteorMethod<PublicPlayerIdentity>(PLAYER_PROFILE_METHODS.getMine)
      .then((identity) => {
        if (!isActive) {
          return;
        }

        setLoadedProfileUserId(auth.userId);
        setDisplayName(identity.displayName ?? '');
        setProfileError(null);
        setProfileSavedMessage(null);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setLoadedProfileUserId(auth.userId);
        setProfileError(errorMessage(error));
        setProfileSavedMessage(null);
      });

    return () => {
      isActive = false;
    };
  }, [auth.userId, isVerifiedAccountReady]);

  const savePublicPlayerName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSavedMessage(null);

    try {
      const identity = await callMeteorMethod<PublicPlayerIdentity>(
        PLAYER_PROFILE_METHODS.updateMine,
        {
          displayName,
        },
      );

      setDisplayName(identity.displayName ?? '');
      setProfileSavedMessage('Public player name saved.');
    } catch (error) {
      setProfileError(errorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  };

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
        <form
          aria-label="Public player name section"
          className="mt-6 rounded-md border border-rooster-line p-4"
          onSubmit={(event) => void savePublicPlayerName(event)}
        >
          <label
            className="text-sm font-black uppercase text-rooster-red"
            htmlFor="public-player-name"
          >
            Public player name
          </label>
          <input
            className="focus-ring mt-3 min-h-11 w-full rounded-md border border-rooster-line bg-white px-3 text-base font-bold text-rooster-ink disabled:cursor-not-allowed disabled:bg-rooster-paper"
            disabled={isProfileLoading || isSavingProfile}
            id="public-player-name"
            maxLength={30}
            name="displayName"
            type="text"
            value={isProfileLoading ? '' : displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setProfileError(null);
              setProfileSavedMessage(null);
            }}
          />
          <p className="mt-2 text-sm leading-6 text-rooster-muted">
            This name may be shown to other Rugby Rooster players on
            leaderboards and other competitive views.
          </p>
          {activeProfileError ? (
            <p
              className="mt-3 rounded-md border border-rooster-red/30 bg-rooster-red/10 p-3 text-sm font-bold text-rooster-ink"
              role="alert"
            >
              {activeProfileError}
            </p>
          ) : null}
          {activeProfileSavedMessage ? (
            <p
              className="mt-3 rounded-md border border-rooster-grass/30 bg-rooster-grass/10 p-3 text-sm font-bold text-rooster-ink"
              role="status"
            >
              {activeProfileSavedMessage}
            </p>
          ) : null}
          <button
            className="focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-rooster-red px-4 text-sm font-black text-white transition hover:bg-rooster-ink disabled:cursor-not-allowed disabled:bg-rooster-muted sm:w-auto"
            disabled={isProfileLoading || isSavingProfile}
            type="submit"
          >
            {isSavingProfile ? 'Saving' : 'Save'}
          </button>
        </form>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
};
