import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';

import type { RugbyRoosterClientUser } from '/imports/shared/types/meteor-passwordless';

export const useAuthState = () =>
  useTracker(() => {
    const userId = Meteor.userId();
    const user = Meteor.user() as RugbyRoosterClientUser | null;
    const status = Meteor.status();
    const isLoading = Meteor.loggingIn() || Boolean(userId && !user);
    const primaryEmail = user?.emails?.[0] ?? null;

    return {
      isAuthenticated: Boolean(userId),
      isConnected: status.connected,
      isLoading,
      isPlatformAdmin: user?.roles?.platformAdmin === true,
      isVerified:
        user?.emails?.some((email) => email.verified === true) ?? false,
      primaryEmail,
      user,
      userId,
    };
  }, []);
