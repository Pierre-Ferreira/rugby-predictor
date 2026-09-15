import { createRulesetSnapshot, defaultRuleset } from '/imports/shared/scoring';

export const createDefaultFixtureRulesetSnapshot = () =>
  createRulesetSnapshot(defaultRuleset);
