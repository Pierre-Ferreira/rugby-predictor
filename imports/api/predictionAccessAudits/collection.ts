import { Mongo } from 'meteor/mongo';

import type { PredictionAccessAuditDocument } from '/imports/shared/predictionAccess';

export const PredictionAccessAudits =
  new Mongo.Collection<PredictionAccessAuditDocument>(
    'prediction_access_audits',
  );
