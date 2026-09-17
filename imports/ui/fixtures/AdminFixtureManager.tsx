import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';

import { Fixtures } from '/imports/api/fixtures/collection';
import { MatchResults } from '/imports/api/matchResults/collection';
import {
  ADMIN_FIXTURE_TIME_ZONE_LABEL,
  DEFAULT_ADMIN_FIXTURE_LIMIT,
  FIXTURE_METHODS,
  FIXTURE_PUBLICATIONS,
  formatUtcInstantForJohannesburgInput,
  parseJohannesburgDateTimeInputToUtcInstant,
  type FixtureDocument,
  type FixtureMutationResult,
} from '/imports/shared/fixtures';
import {
  MATCH_RESULT_PUBLICATIONS,
  matchResultAdminState,
  matchResultAdminStateLabel,
} from '/imports/shared/matchResults';
import { callMeteorMethod } from '../auth/methodCall';
import { AppLink } from '../components/AppLink';
import {
  fixtureResultsPath,
  fixtureStatusClassName,
  fixtureStatusLabel,
  kickoffLabel,
} from './fixtureUi';
import {
  AdminFixtureQuestionConfigurator,
  type QuestionConfigSession,
} from './AdminFixtureQuestionConfigurator';
import { predictionQuestionConfigForFixture } from '/imports/shared/predictionQuestions';

interface FixtureFormState {
  readonly competitionDisplayName: string;
  readonly scheduledKickoffLocal: string;
  readonly team1DisplayName: string;
  readonly team2DisplayName: string;
  readonly venueDisplayName: string;
}

interface FixturePageCursor {
  readonly fixtureId: string;
  readonly scheduledKickoffAt: string;
}

interface FixturePaginationState {
  readonly cursor: FixturePageCursor | null;
  readonly previousCursors: readonly (FixturePageCursor | null)[];
}

interface FixtureEditSession {
  readonly expectedRevision: number;
  readonly fixtureId: string;
}

const emptyForm: FixtureFormState = {
  competitionDisplayName: '',
  scheduledKickoffLocal: '',
  team1DisplayName: '',
  team2DisplayName: '',
  venueDisplayName: '',
};

const firstPageState = (): FixturePaginationState => ({
  cursor: null,
  previousCursors: [],
});

const cursorFromFixture = (fixture: FixtureDocument): FixturePageCursor => ({
  fixtureId: fixture._id,
  scheduledKickoffAt: fixture.scheduledKickoffAt.toISOString(),
});

const adminFixtureSelector = (
  cursor: FixturePageCursor | null,
): Record<string, unknown> => {
  if (!cursor) {
    return {};
  }

  const cursorDate = new Date(cursor.scheduledKickoffAt);

  return {
    $or: [
      {
        scheduledKickoffAt: {
          $lt: cursorDate,
        },
      },
      {
        _id: {
          $gt: cursor.fixtureId,
        },
        scheduledKickoffAt: cursorDate,
      },
    ],
  };
};

const messageFromError = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const record = error as {
      readonly message?: unknown;
      readonly reason?: unknown;
    };

    if (typeof record.reason === 'string') {
      return record.reason;
    }

    if (typeof record.message === 'string') {
      return record.message;
    }
  }

  return 'The fixture operation failed.';
};

const formFromFixture = (fixture: FixtureDocument): FixtureFormState => ({
  competitionDisplayName: fixture.competitionDisplayName,
  scheduledKickoffLocal: formatUtcInstantForJohannesburgInput(
    fixture.scheduledKickoffAt,
  ),
  team1DisplayName: fixture.team1DisplayName,
  team2DisplayName: fixture.team2DisplayName,
  venueDisplayName: fixture.venueDisplayName ?? '',
});

export const AdminFixtureManager = () => {
  const [editSession, setEditSession] = useState<FixtureEditSession | null>(
    null,
  );
  const [form, setForm] = useState<FixtureFormState>(emptyForm);
  const [feedback, setFeedback] = useState<{
    readonly code?: string;
    readonly kind: 'error' | 'success';
    readonly message: string;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pagination, setPagination] = useState(firstPageState);
  const [questionSession, setQuestionSession] =
    useState<QuestionConfigSession | null>(null);
  const pageSize = DEFAULT_ADMIN_FIXTURE_LIMIT;

  const { fixtures, isReady, resultStateByFixtureId } = useTracker(() => {
    const handle = Meteor.subscribe(FIXTURE_PUBLICATIONS.adminList, {
      ...(pagination.cursor ? { cursor: pagination.cursor } : {}),
      limit: pageSize,
    });
    const fixtureRows = Fixtures.find(adminFixtureSelector(pagination.cursor), {
      limit: pageSize + 1,
      sort: {
        scheduledKickoffAt: -1,
        _id: 1,
      },
    }).fetch();
    const visibleFixtureIds = fixtureRows
      .slice(0, pageSize)
      .map((fixture) => fixture._id);
    const resultHandle =
      visibleFixtureIds.length > 0
        ? Meteor.subscribe(MATCH_RESULT_PUBLICATIONS.adminSummaries, {
            fixtureIds: visibleFixtureIds,
          })
        : { ready: () => true };
    const resultSummaries =
      visibleFixtureIds.length > 0
        ? MatchResults.find({
            fixtureId: {
              $in: visibleFixtureIds,
            },
          }).fetch()
        : [];

    return {
      fixtures: fixtureRows,
      isReady: handle.ready() && resultHandle.ready(),
      resultStateByFixtureId: new Map(
        resultSummaries.map((result) => [
          result.fixtureId,
          matchResultAdminState(result),
        ]),
      ),
    };
  }, [pageSize, pagination.cursor]);

  const visibleFixtures = useMemo(
    () => fixtures.slice(0, pageSize),
    [fixtures, pageSize],
  );
  const hasNextPage = fixtures.length > pageSize;
  const hasPreviousPage = pagination.previousCursors.length > 0;
  const lastVisibleFixture = visibleFixtures[visibleFixtures.length - 1];
  const editingFixture = useMemo(
    () =>
      visibleFixtures.find(
        (fixture) => fixture._id === editSession?.fixtureId,
      ) ?? null,
    [editSession?.fixtureId, visibleFixtures],
  );
  const questionFixture = useMemo(
    () =>
      visibleFixtures.find(
        (fixture) => fixture._id === questionSession?.fixtureId,
      ) ?? null,
    [questionSession?.fixtureId, visibleFixtures],
  );
  const isEditing = Boolean(editSession);
  const hasEditConflict = isEditing && feedback?.code === 'fixture-conflict';

  const updateField =
    (field: keyof FixtureFormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const resetForm = () => {
    setEditSession(null);
    setForm(emptyForm);
  };

  const cancelEdit = () => {
    resetForm();
    setFeedback(null);
  };

  const reloadEditSession = () => {
    if (!editingFixture) {
      setFeedback({
        code: 'fixture-edit-unavailable',
        kind: 'error',
        message:
          'The current fixture is not visible on this page. Cancel editing or return to its page before reloading.',
      });
      return;
    }

    setEditSession({
      expectedRevision: editingFixture.revision,
      fixtureId: editingFixture._id,
    });
    setForm(formFromFixture(editingFixture));
    setFeedback({
      kind: 'success',
      message: 'Fixture form reloaded. Unsaved values were replaced.',
    });
  };

  const openQuestionConfiguration = (fixture: FixtureDocument) => {
    try {
      setQuestionSession({
        config: predictionQuestionConfigForFixture(fixture),
        expectedRevision: fixture.revision,
        fixtureId: fixture._id,
        fixtureLabel: `${fixture.team1DisplayName} vs ${fixture.team2DisplayName}`,
      });
      setFeedback(null);
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: messageFromError(error),
      });
    }
  };

  const reloadQuestionConfiguration = () => {
    if (!questionFixture || !questionSession) {
      return;
    }

    try {
      setQuestionSession({
        config: predictionQuestionConfigForFixture(questionFixture),
        expectedRevision: questionFixture.revision,
        fixtureId: questionFixture._id,
        fixtureLabel: `${questionFixture.team1DisplayName} vs ${questionFixture.team2DisplayName}`,
      });
      setFeedback(null);
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: messageFromError(error),
      });
    }
  };

  const detailsPayload = () => {
    const kickoff = parseJohannesburgDateTimeInputToUtcInstant(
      form.scheduledKickoffLocal,
    );

    if (!kickoff) {
      throw new Error(
        `Enter kickoff as a valid ${ADMIN_FIXTURE_TIME_ZONE_LABEL} date and time.`,
      );
    }

    return {
      competitionDisplayName: form.competitionDisplayName,
      scheduledKickoffAt: kickoff.toISOString(),
      team1DisplayName: form.team1DisplayName,
      team2DisplayName: form.team2DisplayName,
      venueDisplayName: form.venueDisplayName,
    };
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setPendingAction('save');

    try {
      const details = detailsPayload();
      const session = editSession;
      const result = session
        ? await callMeteorMethod<FixtureMutationResult>(
            FIXTURE_METHODS.editDetails,
            {
              details,
              expectedRevision: session.expectedRevision,
              fixtureId: session.fixtureId,
            },
          )
        : await callMeteorMethod<FixtureMutationResult>(
            FIXTURE_METHODS.createDraft,
            {
              details,
            },
          );

      setFeedback({
        kind: 'success',
        message:
          result.status === 'updated'
            ? 'Fixture details saved.'
            : 'Draft fixture created.',
      });
      resetForm();
    } catch (error) {
      setFeedback({
        code:
          error && typeof error === 'object'
            ? String((error as { readonly error?: unknown }).error ?? '')
            : undefined,
        kind: 'error',
        message: messageFromError(error),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const publishFixture = async (fixture: FixtureDocument) => {
    setFeedback(null);
    setPendingAction(`publish:${fixture._id}`);

    try {
      const result = await callMeteorMethod<FixtureMutationResult>(
        FIXTURE_METHODS.publish,
        {
          expectedRevision: fixture.revision,
          fixtureId: fixture._id,
        },
      );

      setFeedback({
        kind: 'success',
        message:
          result.status === 'already-published'
            ? 'Fixture was already published.'
            : 'Fixture published.',
      });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: messageFromError(error),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const cancelFixture = async (fixture: FixtureDocument) => {
    if (
      !window.confirm(
        `Cancel ${fixture.team1DisplayName} vs ${fixture.team2DisplayName}?`,
      )
    ) {
      return;
    }

    setFeedback(null);
    setPendingAction(`cancel:${fixture._id}`);

    try {
      const result = await callMeteorMethod<FixtureMutationResult>(
        FIXTURE_METHODS.cancel,
        {
          expectedRevision: fixture.revision,
          fixtureId: fixture._id,
        },
      );

      setFeedback({
        kind: 'success',
        message:
          result.status === 'already-cancelled'
            ? 'Fixture was already cancelled.'
            : 'Fixture cancelled.',
      });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: messageFromError(error),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const goToNextPage = () => {
    if (!lastVisibleFixture) {
      return;
    }

    resetForm();
    setQuestionSession(null);
    setFeedback(null);
    setPagination((current) => ({
      cursor: cursorFromFixture(lastVisibleFixture),
      previousCursors: [...current.previousCursors, current.cursor],
    }));
  };

  const goToPreviousPage = () => {
    resetForm();
    setQuestionSession(null);
    setFeedback(null);
    setPagination((current) => {
      const previousCursors = current.previousCursors.slice(0, -1);
      const cursor =
        current.previousCursors[current.previousCursors.length - 1] ?? null;

      return {
        cursor,
        previousCursors,
      };
    });
  };

  return (
    <section className="mt-8 border-t border-rooster-line pt-8">
      {feedback ? (
        <p
          className={[
            'mb-4 rounded-md border px-3 py-2 text-sm font-bold',
            feedback.kind === 'success'
              ? 'border-rooster-grass/30 bg-rooster-grass/10 text-rooster-grass'
              : 'border-rooster-red/30 bg-rooster-red/10 text-rooster-red',
          ].join(' ')}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form
          className="rounded-md border border-rooster-line p-4"
          onSubmit={submitForm}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-rooster-ink">
                {isEditing ? 'Edit fixture' : 'Create draft fixture'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-rooster-muted">
                Kickoff entry uses {ADMIN_FIXTURE_TIME_ZONE_LABEL}.
              </p>
            </div>
            {isEditing ? (
              <div className="flex flex-wrap gap-2">
                <button
                  className="focus-ring rounded-md px-3 py-2 text-sm font-bold text-rooster-muted hover:bg-rooster-paper disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(pendingAction) || !editingFixture}
                  type="button"
                  onClick={reloadEditSession}
                >
                  Reload and replace form
                </button>
                <button
                  className="focus-ring rounded-md px-3 py-2 text-sm font-bold text-rooster-muted hover:bg-rooster-paper disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(pendingAction)}
                  type="button"
                  onClick={cancelEdit}
                >
                  Cancel edit
                </button>
              </div>
            ) : null}
          </div>

          {hasEditConflict ? (
            <p className="mt-4 rounded-md border border-rooster-red/30 bg-rooster-red/10 px-3 py-2 text-sm font-bold text-rooster-red">
              This edit still uses the original revision. Reload fixture
              replaces unsaved values.
            </p>
          ) : null}

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-rooster-ink">
              Team 1 display name
              <input
                className="focus-ring min-h-11 rounded-md border border-rooster-line px-3 py-2 font-normal"
                value={form.team1DisplayName}
                onChange={updateField('team1DisplayName')}
                required
                maxLength={80}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-rooster-ink">
              Team 2 display name
              <input
                className="focus-ring min-h-11 rounded-md border border-rooster-line px-3 py-2 font-normal"
                value={form.team2DisplayName}
                onChange={updateField('team2DisplayName')}
                required
                maxLength={80}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-rooster-ink">
              Competition display name
              <input
                className="focus-ring min-h-11 rounded-md border border-rooster-line px-3 py-2 font-normal"
                value={form.competitionDisplayName}
                onChange={updateField('competitionDisplayName')}
                required
                maxLength={120}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-rooster-ink">
              Kickoff, {ADMIN_FIXTURE_TIME_ZONE_LABEL}
              <input
                className="focus-ring min-h-11 rounded-md border border-rooster-line px-3 py-2 font-normal"
                type="datetime-local"
                value={form.scheduledKickoffLocal}
                onChange={updateField('scheduledKickoffLocal')}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-rooster-ink">
              Venue
              <input
                className="focus-ring min-h-11 rounded-md border border-rooster-line px-3 py-2 font-normal"
                value={form.venueDisplayName}
                onChange={updateField('venueDisplayName')}
                maxLength={160}
              />
            </label>
          </div>

          <button
            className="focus-ring mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-rooster-red px-4 text-sm font-black text-white transition hover:bg-rooster-ink disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pendingAction === 'save'}
            type="submit"
          >
            {pendingAction === 'save'
              ? 'Saving'
              : isEditing
                ? 'Save fixture'
                : 'Create draft'}
          </button>
        </form>

        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-rooster-ink">
                Fixture list
              </h2>
              <p className="mt-2 text-sm leading-6 text-rooster-muted">
                Published cancelled fixtures remain visible. Cancelled fixtures
                are read-only.
              </p>
            </div>
          </div>

          {!isReady ? (
            <p className="mt-4 rounded-md border border-rooster-line bg-rooster-paper px-4 py-3 text-sm font-bold text-rooster-muted">
              Loading fixtures
            </p>
          ) : visibleFixtures.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-rooster-line bg-rooster-paper px-4 py-5 text-sm font-bold text-rooster-muted">
              No fixtures have been created yet.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {visibleFixtures.map((fixture) => {
                const disabled = Boolean(pendingAction);

                return (
                  <li
                    className="rounded-md border border-rooster-line p-4"
                    key={fixture._id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={[
                              'inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase',
                              fixtureStatusClassName(fixture),
                            ].join(' ')}
                          >
                            {fixtureStatusLabel(fixture)}
                          </span>
                          <span className="text-xs font-bold uppercase text-rooster-muted">
                            {fixture.competitionDisplayName}
                          </span>
                        </div>
                        <h3 className="mt-2 text-lg font-black text-rooster-ink">
                          {fixture.team1DisplayName} vs{' '}
                          {fixture.team2DisplayName}
                        </h3>
                        <p className="mt-1 text-sm font-bold text-rooster-muted">
                          {kickoffLabel(fixture)}
                        </p>
                        <p className="mt-2 text-xs font-black uppercase text-rooster-muted">
                          Result:{' '}
                          {matchResultAdminStateLabel(
                            resultStateByFixtureId.get(fixture._id) ?? 'none',
                          )}
                        </p>
                        {fixture.venueDisplayName ? (
                          <p className="mt-1 text-sm text-rooster-muted">
                            {fixture.venueDisplayName}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={disabled || fixture.isCancelled}
                          type="button"
                          onClick={() => {
                            setEditSession({
                              expectedRevision: fixture.revision,
                              fixtureId: fixture._id,
                            });
                            setForm(formFromFixture(fixture));
                            setFeedback(null);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={disabled}
                          type="button"
                          onClick={() => openQuestionConfiguration(fixture)}
                        >
                          Prediction questions
                        </button>
                        {fixture.visibility === 'published' ? (
                          <AppLink
                            className="focus-ring inline-flex min-h-10 items-center rounded-md border border-rooster-line px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-paper"
                            to={fixtureResultsPath(fixture._id)}
                          >
                            Results
                          </AppLink>
                        ) : (
                          <button
                            className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 text-sm font-bold text-rooster-muted disabled:cursor-not-allowed disabled:opacity-50"
                            disabled
                            type="button"
                          >
                            Results
                          </button>
                        )}
                        <button
                          className="focus-ring min-h-10 rounded-md bg-rooster-grass px-3 text-sm font-bold text-white transition hover:bg-rooster-ink disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={
                            disabled ||
                            fixture.visibility === 'published' ||
                            fixture.isCancelled
                          }
                          type="button"
                          onClick={() => void publishFixture(fixture)}
                        >
                          {pendingAction === `publish:${fixture._id}`
                            ? 'Publishing'
                            : 'Publish'}
                        </button>
                        <button
                          className="focus-ring min-h-10 rounded-md border border-rooster-red/40 px-3 text-sm font-bold text-rooster-red transition hover:bg-rooster-red/10 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={disabled || fixture.isCancelled}
                          type="button"
                          onClick={() => void cancelFixture(fixture)}
                        >
                          {pendingAction === `cancel:${fixture._id}`
                            ? 'Cancelling'
                            : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {hasPreviousPage || hasNextPage ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {hasPreviousPage ? (
                <button
                  className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-paper"
                  type="button"
                  onClick={goToPreviousPage}
                >
                  Previous fixtures
                </button>
              ) : null}
              {hasNextPage ? (
                <button
                  className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-paper"
                  type="button"
                  onClick={goToNextPage}
                >
                  Next fixtures
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {questionSession ? (
        <AdminFixtureQuestionConfigurator
          key={questionSession.fixtureId}
          currentFixture={questionFixture}
          session={questionSession}
          onClose={() => setQuestionSession(null)}
          onReload={reloadQuestionConfiguration}
          onSaved={({ config, expectedRevision }) =>
            setQuestionSession((current) =>
              current
                ? {
                    ...current,
                    config,
                    expectedRevision,
                  }
                : current,
            )
          }
        />
      ) : null}
    </section>
  );
};
