import { Mongo } from 'meteor/mongo';

import type { PlayerProfileDocument } from '/imports/shared/playerProfiles';

export const PlayerProfiles = new Mongo.Collection<PlayerProfileDocument>(
  'player_profiles',
);
