import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ADMIN_FIXTURE_LIMIT,
  DEFAULT_PUBLIC_FIXTURE_LIMIT,
  FixtureValidationError,
  MAX_ADMIN_FIXTURE_LIMIT,
  MAX_PUBLIC_FIXTURE_LIMIT,
  formatUtcInstantForJohannesburgInput,
  normalizeFixtureDisplayName,
  parseJohannesburgDateTimeInputToUtcInstant,
  sanitizeAdminFixtureListOptions,
  sanitizeCreateDraftInput,
  sanitizeEditDetailsInput,
  sanitizePublicFixtureListOptions,
  sanitizeStateMutationInput,
} from '../../imports/shared/fixtures';

describe('fixture validation and timezone helpers', () => {
  it('converts Johannesburg admin entry to a UTC instant without machine timezone dependence', () => {
    const kickoff =
      parseJohannesburgDateTimeInputToUtcInstant('2026-10-25T15:30');

    expect(kickoff?.toISOString()).toBe('2026-10-25T13:30:00.000Z');
    expect(formatUtcInstantForJohannesburgInput(kickoff ?? new Date(0))).toBe(
      '2026-10-25T15:30',
    );
  });

  it('rejects impossible Johannesburg local date inputs', () => {
    expect(parseJohannesburgDateTimeInputToUtcInstant('2026-02-31T15:30')).toBe(
      null,
    );
    expect(parseJohannesburgDateTimeInputToUtcInstant('not-a-date')).toBe(null);
  });

  it('normalizes fixture display names for distinct Team 1 and Team 2 validation', () => {
    expect(normalizeFixtureDisplayName('  Sharks   XV ')).toBe('sharks xv');

    expect(() =>
      sanitizeCreateDraftInput({
        details: {
          competitionDisplayName: 'United Rugby Championship',
          scheduledKickoffAt: '2026-10-25T13:30:00.000Z',
          team1DisplayName: 'Sharks XV',
          team2DisplayName: '  SHARKS   XV ',
        },
      }),
    ).toThrow(FixtureValidationError);
  });

  it('rejects client attempts to inject server-owned fields', () => {
    expect(() =>
      sanitizeCreateDraftInput({
        details: {
          competitionDisplayName: 'United Rugby Championship',
          createdByAdminId: 'attacker',
          revision: 99,
          scheduledKickoffAt: '2026-10-25T13:30:00.000Z',
          team1DisplayName: 'Stormers',
          team2DisplayName: 'Bulls',
          visibility: 'published',
        },
      }),
    ).toThrow(/unsupported fields/i);

    expect(() =>
      sanitizeEditDetailsInput({
        details: {
          competitionDisplayName: 'United Rugby Championship',
          scheduledKickoffAt: '2026-10-25T13:30:00.000Z',
          team1DisplayName: 'Stormers',
          team2DisplayName: 'Bulls',
        },
        expectedRevision: 1,
        fixtureId: 'fixture_1',
        revision: 2,
      }),
    ).toThrow(/unsupported fields/i);
  });

  it('sanitizes public list mode, limit, boundary, and cursor', () => {
    const defaults = sanitizePublicFixtureListOptions(undefined);

    expect(defaults.mode).toBe('upcoming');
    expect(defaults.limit).toBe(DEFAULT_PUBLIC_FIXTURE_LIMIT);

    const past = sanitizePublicFixtureListOptions({
      boundary: '2026-10-25T13:30:00.000Z',
      cursor: {
        fixtureId: 'fixture_1',
        scheduledKickoffAt: '2026-10-26T13:30:00.000Z',
      },
      limit: MAX_PUBLIC_FIXTURE_LIMIT,
      mode: 'past',
    });

    expect(past.mode).toBe('past');
    expect(past.boundary.toISOString()).toBe('2026-10-25T13:30:00.000Z');
    expect(past.cursor?.fixtureId).toBe('fixture_1');
    expect(past.cursor?.scheduledKickoffAt.toISOString()).toBe(
      '2026-10-26T13:30:00.000Z',
    );
    expect(past.limit).toBe(MAX_PUBLIC_FIXTURE_LIMIT);

    expect(() =>
      sanitizePublicFixtureListOptions({
        limit: MAX_PUBLIC_FIXTURE_LIMIT + 1,
      }),
    ).toThrow(FixtureValidationError);

    expect(() =>
      sanitizePublicFixtureListOptions({
        cursor: {
          fixtureId: 'bad fixture id',
          scheduledKickoffAt: '2026-10-26T13:30:00.000Z',
        },
      }),
    ).toThrow(FixtureValidationError);
  });

  it('sanitizes admin list pagination options', () => {
    const defaults = sanitizeAdminFixtureListOptions(undefined);

    expect(defaults.limit).toBe(DEFAULT_ADMIN_FIXTURE_LIMIT);

    const options = sanitizeAdminFixtureListOptions({
      cursor: {
        fixtureId: 'fixture_1',
        scheduledKickoffAt: '2026-10-26T13:30:00.000Z',
      },
      limit: MAX_ADMIN_FIXTURE_LIMIT,
    });

    expect(options.limit).toBe(MAX_ADMIN_FIXTURE_LIMIT);
    expect(options.cursor?.fixtureId).toBe('fixture_1');

    expect(() =>
      sanitizeAdminFixtureListOptions({
        limit: MAX_ADMIN_FIXTURE_LIMIT + 1,
      }),
    ).toThrow(FixtureValidationError);

    expect(() =>
      sanitizeAdminFixtureListOptions({
        cursor: {
          extra: true,
          fixtureId: 'fixture_1',
          scheduledKickoffAt: '2026-10-26T13:30:00.000Z',
        },
      }),
    ).toThrow(FixtureValidationError);
  });

  it('requires integer expected revisions for fixture mutations', () => {
    const validEdit = sanitizeEditDetailsInput({
      details: {
        competitionDisplayName: 'United Rugby Championship',
        scheduledKickoffAt: '2026-10-25T13:30:00.000Z',
        team1DisplayName: 'Stormers',
        team2DisplayName: 'Bulls',
      },
      expectedRevision: 1,
      fixtureId: 'fixture_1',
    });
    const validStateChange = sanitizeStateMutationInput({
      expectedRevision: 2,
      fixtureId: 'fixture_1',
    });

    expect(validEdit.expectedRevision).toBe(1);
    expect(validStateChange.expectedRevision).toBe(2);

    expect(() =>
      sanitizeStateMutationInput({
        expectedRevision: '2',
        fixtureId: 'fixture_1',
      }),
    ).toThrow(FixtureValidationError);

    expect(() =>
      sanitizeStateMutationInput({
        expectedRevision: 0,
        fixtureId: 'fixture_1',
      }),
    ).toThrow(FixtureValidationError);
  });
});
