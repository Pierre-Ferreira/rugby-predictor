import { Mongo } from 'meteor/mongo';

import type { FixtureDocument } from '/imports/shared/fixtures';

export const Fixtures = new Mongo.Collection<FixtureDocument>('fixtures');
