import {
  RULESET_SCHEMA_VERSION,
  type QuestionDefinition,
  type RulesetSnapshot,
} from './types';

export const defaultQuestions = [
  {
    id: 'match-result',
    label: 'Match result',
    type: 'built-in-categorical',
    enabled: true,
    incorrectDeduction: 5_000,
  },
  {
    id: 'tries',
    label: 'Tries',
    type: 'built-in-team-numeric',
    enabled: true,
    rate: 50,
  },
  {
    id: 'conversions',
    label: 'Conversions',
    type: 'built-in-team-numeric',
    enabled: true,
    rate: 50,
  },
  {
    id: 'penalty-kicks',
    label: 'Penalty kicks',
    type: 'built-in-team-numeric',
    enabled: true,
    rate: 100,
  },
  {
    id: 'drop-goals',
    label: 'Drop goals',
    type: 'built-in-team-numeric',
    enabled: true,
    rate: 150,
  },
  {
    id: 'team-score',
    label: 'Team score',
    type: 'built-in-team-numeric',
    enabled: true,
    rate: 20,
  },
  {
    id: 'yellow-cards',
    label: 'Yellow cards',
    type: 'built-in-team-numeric',
    enabled: true,
    rate: 200,
  },
  {
    id: 'red-cards',
    label: 'Red cards',
    type: 'built-in-team-numeric',
    enabled: true,
    rate: 200,
  },
  {
    id: 'first-try',
    label: 'First try',
    type: 'built-in-categorical',
    enabled: true,
    incorrectDeduction: 250,
  },
  {
    id: 'highest-scoring-half',
    label: 'Highest-scoring half',
    type: 'built-in-categorical',
    enabled: true,
    incorrectDeduction: 250,
  },
  {
    id: 'half-time-leader',
    label: 'Half-time leader',
    type: 'built-in-categorical',
    enabled: true,
    incorrectDeduction: 250,
  },
] as const satisfies readonly QuestionDefinition[];

export const defaultRuleset = {
  schemaVersion: RULESET_SCHEMA_VERSION,
  id: 'rugby-rooster-default',
  version: 'ccpp-003-v1',
  questions: defaultQuestions,
} as const satisfies RulesetSnapshot;
