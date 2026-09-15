import { useState } from 'react';
import { Meteor } from 'meteor/meteor';

import { navigateTo } from '../navigation';

interface SignOutButtonProps {
  readonly className?: string;
  readonly label?: string;
  readonly pendingLabel?: string;
  readonly redirectTo?: string;
}

export const SignOutButton = ({
  className,
  label = 'Sign out',
  pendingLabel = 'Signing out',
  redirectTo = '/games',
}: SignOutButtonProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = () => {
    setError(null);
    setIsSigningOut(true);
    Meteor.logout((logoutError) => {
      setIsSigningOut(false);

      if (logoutError) {
        setError('Sign-out did not complete. Please try again.');
        return;
      }

      navigateTo(redirectTo, true);
    });
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        className={
          className ??
          'focus-ring inline-flex min-h-10 items-center rounded-md border border-rooster-line bg-white px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-sun'
        }
        disabled={isSigningOut}
        onClick={signOut}
        type="button"
      >
        {isSigningOut ? pendingLabel : label}
      </button>
      {error ? (
        <span className="text-xs font-semibold text-rooster-red">{error}</span>
      ) : null}
    </span>
  );
};
