export const FIXTURE_METHODS = {
  cancel: 'fixtures.admin.cancel',
  createDraft: 'fixtures.admin.createDraft',
  editDetails: 'fixtures.admin.editDetails',
  lockPredictions: 'fixtures.admin.lockPredictions',
  publish: 'fixtures.admin.publish',
  reopenPredictions: 'fixtures.admin.reopenPredictions',
  resetPredictionAccess: 'fixtures.admin.resetPredictionAccess',
  saveQuestionConfig: 'fixtures.admin.saveQuestionConfig',
} as const;

export const TEST_FIXTURE_METHODS = {
  createPublished: 'test.fixtures.createPublished',
  reset: 'test.fixtures.reset',
} as const;
