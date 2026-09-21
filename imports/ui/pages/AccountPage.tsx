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
import {
  PlayerLoadingState,
  PlayerPage,
  PlayerPageHeader,
  RugbyRoosterPersonality,
  StatusBadge,
} from '../components/player';

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
    return (
      <PlayerPage>
        <PlayerLoadingState label="Checking your Rugby Rooster session" />
      </PlayerPage>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <PlayerPage>
        <SignInRequiredState
          currentPath="/account"
          message="Your account page is available after you open a Rugby Rooster email sign-in link."
          title="Sign in to view your account"
        />
      </PlayerPage>
    );
  }

  if (!auth.isVerified) {
    return (
      <PlayerPage>
        <AccessDeniedState
          message="Open the latest Rugby Rooster sign-in email to verify the address attached to this account."
          title="Email verification is required"
        />
      </PlayerPage>
    );
  }

  return (
    <PlayerPage>
      <PlayerPageHeader
        eyebrow="Player account"
        personality={
          <RugbyRoosterPersonality
            message="Name on the board. Email in the shed."
            mood="confident"
            size="compact"
          />
        }
        subtitle="Manage the public name other players may see and keep private account details separate."
        title="Your Rugby Rooster account"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form
          aria-label="Public player name section"
          className="rr-surface rr-surface--raised"
          onSubmit={(event) => void savePublicPlayerName(event)}
        >
          <label className="rr-section-eyebrow" htmlFor="public-player-name">
            Public player name
          </label>
          <h2 className="rr-section-title mt-2">Leaderboard identity</h2>
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
            leaderboards and other competitive views. Your email stays private.
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
            className="focus-ring rr-button rr-button-primary mt-4 w-full sm:w-auto"
            disabled={isProfileLoading || isSavingProfile}
            type="submit"
          >
            {isSavingProfile ? 'Saving' : 'Save'}
          </button>
        </form>

        <section className="rr-surface">
          <p className="rr-section-eyebrow">Private account</p>
          <dl className="mt-4 grid gap-4">
            <div className="rr-mini-stat">
              <dt>Email</dt>
              <dd>{auth.primaryEmail?.address}</dd>
            </div>
            <div className="rr-mini-stat">
              <dt>Status</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <StatusBadge label="Verified player" tone="success" />
              </dd>
            </div>
          </dl>
          <div className="mt-5">
            <SignOutButton className="focus-ring rr-button rr-button-secondary" />
          </div>
        </section>
      </div>
    </PlayerPage>
  );
};
