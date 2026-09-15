import type { Meteor } from 'meteor/meteor';

declare module 'meteor/meteor' {
  namespace Meteor {
    function passwordlessLoginWithToken(
      selector: { readonly email: string },
      token: string,
      callback?: (error?: Error) => void,
    ): void;
  }
}

export interface RugbyRoosterClientUser extends Meteor.User {
  readonly emails?: readonly {
    readonly address: string;
    readonly verified?: boolean;
  }[];
  readonly roles?: {
    readonly platformAdmin?: boolean;
  };
}
