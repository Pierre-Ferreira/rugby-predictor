import { Mongo } from 'meteor/mongo';

import type { MatchResultDocument } from '/imports/shared/matchResults';

export const MatchResults = new Mongo.Collection<MatchResultDocument>(
  'match_results',
);
