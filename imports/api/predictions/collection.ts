import { Mongo } from 'meteor/mongo';

import type { PredictionEntryDocument } from '/imports/shared/predictions';

export const Predictions = new Mongo.Collection<PredictionEntryDocument>(
  'predictions',
);
