import { type ChangeEvent, type FormEvent, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';

import { Fixtures } from '/imports/api/fixtures/collection';
import { MatchResults } from '/imports/api/matchResults/collection';
import type { FixtureDocument } from '/imports/shared/fixtures';
import {
  MATCH_RESULT_METHODS,
  MATCH_RESULT_PUBLICATIONS,
  NO_MATCH_RESULT_REVISION,
  matchResultAdminState,
  matchResultAdminStateLabel,
  type MatchResultDocument,
  type MatchResultMutationResult,
} from '/imports/shared/matchResults';
import {
  deriveMatchResult,
  deriveTeamScore,
  enabledQuestions,
  isBuiltInEnabled,
  scoringComponentFields,
  teamNumericFieldByQuestionId,
  teamSides,
  type FixtureObservations,
  type ObservedValue,
  type QuestionDefinition,
  type RulesetSnapshot,
  type TeamSide,
} from '/imports/shared/scoring';
import { adminSignInPathForReturnTo } from '/imports/shared/auth/redirects';
import { useAuthState } from '../auth/useAuthState';
import { callMeteorMethod } from '../auth/methodCall';
import {
  AccessDeniedState,
  SignInRequiredState,
} from '../components/AuthStates';
import { LoadingState } from '../components/Status';
import { AppLink } from '../components/AppLink';
import { kickoffLabel } from '../fixtures/fixtureUi';

type NumericTeamField =
  | 'tries'
  | 'conversions'
  | 'penaltyKicks'
  | 'dropGoals'
  | 'yellowCards'
  | 'redCards';

interface TeamResultForm {
  readonly conversions: string;
  readonly dropGoals: string;
  readonly penaltyKicks: string;
  readonly redCards: string;
  readonly tries: string;
  readonly yellowCards: string;
}

interface CustomResultFormValue {
  readonly isVoid: boolean;
  readonly value: string;
}

interface ResultFormState {
  readonly customAnswers: Record<string, CustomResultFormValue>;
  readonly firstTry: string;
  readonly halfTimeLeader: string;
  readonly highestScoringHalf: string;
  readonly team1: TeamResultForm;
  readonly team2: TeamResultForm;
}

interface ResultEditSession {
  readonly expectedRevision: number;
  readonly fixtureId: string;
}

const numericFieldLabels = {
  conversions: 'conversions',
  dropGoals: 'drop goals',
  penaltyKicks: 'successful penalty kicks',
  redCards: 'red cards',
  tries: 'tries',
  yellowCards: 'yellow cards',
} as const satisfies Record<NumericTeamField, string>;

const scoringFields = [
  'tries',
  'conversions',
  'penaltyKicks',
  'dropGoals',
] as const satisfies readonly NumericTeamField[];

const cardFields = [
  'yellowCards',
  'redCards',
] as const satisfies readonly NumericTeamField[];

const emptyTeamForm = (): TeamResultForm => ({
  conversions: '',
  dropGoals: '',
  penaltyKicks: '',
  redCards: '',
  tries: '',
  yellowCards: '',
});

const emptyForm = (ruleset: RulesetSnapshot): ResultFormState => ({
  customAnswers: Object.fromEntries(
    customQuestions(ruleset).map((question) => [
      question.id,
      { isVoid: false, value: '' },
    ]),
  ),
  firstTry: '',
  halfTimeLeader: '',
  highestScoringHalf: '',
  team1: emptyTeamForm(),
  team2: emptyTeamForm(),
});

const fixtureIdFromPath = (): string =>
  window.location.pathname.split('/').filter(Boolean)[2] ?? '';

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

  return 'The result operation failed.';
};

const codeFromError = (error: unknown): string | undefined =>
  error && typeof error === 'object'
    ? String((error as { readonly error?: unknown }).error ?? '')
    : undefined;

const customQuestions = (
  ruleset: RulesetSnapshot,
): readonly Extract<
  QuestionDefinition,
  { readonly type: 'custom-numeric' | 'custom-categorical' }
>[] =>
  enabledQuestions(ruleset).filter(
    (
      question,
    ): question is Extract<
      QuestionDefinition,
      { readonly type: 'custom-numeric' | 'custom-categorical' }
    > =>
      question.type === 'custom-numeric' ||
      question.type === 'custom-categorical',
  );

const requiredScoringFields = (
  ruleset: RulesetSnapshot,
): ReadonlySet<NumericTeamField> => {
  const fields = new Set<NumericTeamField>();

  for (const question of enabledQuestions(ruleset)) {
    if (question.id === 'match-result' || question.id === 'team-score') {
      scoringFields.forEach((field) => fields.add(field));
      continue;
    }

    if (question.type !== 'built-in-team-numeric') {
      continue;
    }

    const field = teamNumericFieldByQuestionId[question.id];

    if (scoringFields.includes(field as (typeof scoringFields)[number])) {
      fields.add(field as NumericTeamField);
    }
  }

  return fields;
};

const enabledTeamFields = (
  ruleset: RulesetSnapshot,
): readonly NumericTeamField[] => {
  const fields = new Set<NumericTeamField>(requiredScoringFields(ruleset));

  if (isBuiltInEnabled(ruleset, 'yellow-cards')) {
    fields.add('yellowCards');
  }

  if (isBuiltInEnabled(ruleset, 'red-cards')) {
    fields.add('redCards');
  }

  return [...scoringFields, ...cardFields].filter((field) => fields.has(field));
};

const observationValueText = (
  value: ObservedValue<number> | undefined,
): string => {
  if (!value || value.status === 'pending' || value.value === undefined) {
    return '';
  }

  return String(value.value);
};

const formFromResult = (
  result: MatchResultDocument | null | undefined,
  ruleset: RulesetSnapshot,
): ResultFormState => {
  const form = emptyForm(ruleset);

  if (!result) {
    return form;
  }

  const observations = result.observations;
  const formFromTeam = (side: TeamSide): TeamResultForm => ({
    conversions: observationValueText(observations[side].conversions),
    dropGoals: observationValueText(observations[side].dropGoals),
    penaltyKicks: observationValueText(observations[side].penaltyKicks),
    redCards: observationValueText(observations[side].redCards),
    tries: observationValueText(observations[side].tries),
    yellowCards: observationValueText(observations[side].yellowCards),
  });

  return {
    customAnswers: Object.fromEntries(
      customQuestions(ruleset).map((question) => {
        const observed = observations.customAnswers?.[question.id];

        return [
          question.id,
          {
            isVoid: observed?.status === 'void',
            value:
              observed &&
              observed.status !== 'pending' &&
              observed.status !== 'void'
                ? String(observed.value)
                : '',
          },
        ];
      }),
    ),
    firstTry:
      observations.firstTry?.status === 'pending'
        ? ''
        : (observations.firstTry?.value ?? ''),
    halfTimeLeader:
      observations.halfTimeLeader?.status === 'pending'
        ? ''
        : (observations.halfTimeLeader?.value ?? ''),
    highestScoringHalf:
      observations.highestScoringHalf?.status === 'pending'
        ? ''
        : (observations.highestScoringHalf?.value ?? ''),
    team1: formFromTeam('team1'),
    team2: formFromTeam('team2'),
  };
};

const observedNumberFromText = (value: string): ObservedValue<number> =>
  value.trim() === ''
    ? { status: 'pending' }
    : { status: 'provisional', value: Number(value) };

const observedChoiceFromText = (value: string): ObservedValue<string> =>
  value === '' ? { status: 'pending' } : { status: 'provisional', value };

const buildObservationPayload = (
  form: ResultFormState,
  ruleset: RulesetSnapshot,
): FixtureObservations => {
  const fields = enabledTeamFields(ruleset);
  const observations: {
    customAnswers?: FixtureObservations['customAnswers'];
    firstTry?: FixtureObservations['firstTry'];
    halfTimeLeader?: FixtureObservations['halfTimeLeader'];
    highestScoringHalf?: FixtureObservations['highestScoringHalf'];
    matchStatus: FixtureObservations['matchStatus'];
    team1: FixtureObservations['team1'];
    team2: FixtureObservations['team2'];
  } = {
    matchStatus: 'provisional',
    team1: {},
    team2: {},
  };

  for (const side of teamSides) {
    const team = form[side];
    const normalizedTeam: Record<string, ObservedValue<number>> = {};

    for (const field of fields) {
      normalizedTeam[field] = observedNumberFromText(team[field]);
    }

    (observations as unknown as Record<TeamSide, typeof normalizedTeam>)[side] =
      normalizedTeam;
  }

  if (isBuiltInEnabled(ruleset, 'first-try')) {
    observations.firstTry = observedChoiceFromText(
      form.firstTry,
    ) as FixtureObservations['firstTry'];
  }

  if (isBuiltInEnabled(ruleset, 'highest-scoring-half')) {
    observations.highestScoringHalf = observedChoiceFromText(
      form.highestScoringHalf,
    ) as FixtureObservations['highestScoringHalf'];
  }

  if (isBuiltInEnabled(ruleset, 'half-time-leader')) {
    observations.halfTimeLeader = observedChoiceFromText(
      form.halfTimeLeader,
    ) as FixtureObservations['halfTimeLeader'];
  }

  const activeCustomQuestions = customQuestions(ruleset);

  if (activeCustomQuestions.length > 0) {
    observations.customAnswers = Object.fromEntries(
      activeCustomQuestions.map((question) => {
        const answer = form.customAnswers[question.id] ?? {
          isVoid: false,
          value: '',
        };

        if (answer.isVoid) {
          return [question.id, { status: 'void' }];
        }

        if (answer.value.trim() === '') {
          return [question.id, { status: 'pending' }];
        }

        return [
          question.id,
          {
            status: 'provisional',
            value:
              question.type === 'custom-numeric'
                ? Number(answer.value)
                : answer.value,
          },
        ];
      }),
    );
  }

  return observations;
};

const parseIntegerText = (value: string): number | null =>
  /^\d+$/.test(value.trim()) ? Number(value) : null;

const derivedScore = (form: ResultFormState, side: TeamSide): number | null => {
  const team = form[side];
  const components = {
    conversions: parseIntegerText(team.conversions),
    dropGoals: parseIntegerText(team.dropGoals),
    penaltyKicks: parseIntegerText(team.penaltyKicks),
    tries: parseIntegerText(team.tries),
  };

  if (
    components.conversions === null ||
    components.dropGoals === null ||
    components.penaltyKicks === null ||
    components.tries === null
  ) {
    return null;
  }

  try {
    return deriveTeamScore({
      conversions: components.conversions,
      dropGoals: components.dropGoals,
      penaltyKicks: components.penaltyKicks,
      tries: components.tries,
    });
  } catch {
    return null;
  }
};

const observedStatusLabel = <T,>(value: ObservedValue<T> | undefined) => {
  if (!value || value.status === 'pending') {
    return 'Pending';
  }

  return value.status === 'confirmed' ? 'Confirmed' : 'Provisional';
};

export const AdminFixtureResultsPage = () => {
  const auth = useAuthState();
  const fixtureId = fixtureIdFromPath();
  const currentPath = window.location.pathname;

  if (auth.isLoading) {
    return <LoadingState label="Checking admin access" />;
  }

  if (!auth.isAuthenticated) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <SignInRequiredState
          currentPath={currentPath}
          message="Admin result entry is available only after email-link sign-in with an authorised account."
          signInPath={adminSignInPathForReturnTo(currentPath)}
          title="Sign in to continue"
        />
      </main>
    );
  }

  if (!auth.isVerified || !auth.isPlatformAdmin) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <AccessDeniedState
          message="Result administration is available only to authorised admin accounts."
          title="Admin access is restricted"
        />
      </main>
    );
  }

  return <ResultAdminSession fixtureId={fixtureId} />;
};

const ResultAdminSession = ({ fixtureId }: { readonly fixtureId: string }) => {
  const { fixture, isReady, result } = useTracker(() => {
    const handle = Meteor.subscribe(
      MATCH_RESULT_PUBLICATIONS.adminFixtureContext,
      fixtureId,
    );

    return {
      fixture: Fixtures.findOne(fixtureId),
      isReady: handle.ready(),
      result: MatchResults.findOne({ fixtureId }),
    };
  }, [fixtureId]);

  const ruleset = fixture?.rulesetSnapshot;
  const state = matchResultAdminState(result);
  const stateLabel = matchResultAdminStateLabel(state);

  if (!isReady) {
    return <LoadingState label="Loading result admin" />;
  }

  if (!fixture) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 text-white sm:px-6">
        <section className="rounded-md border border-white/10 bg-white p-6 text-rooster-ink">
          <h1 className="text-2xl font-black">Fixture not found</h1>
          <p className="mt-3 text-sm text-rooster-muted">
            This admin result route does not match an available fixture.
          </p>
          <AppLink
            className="focus-ring mt-5 inline-flex min-h-10 items-center rounded-md bg-rooster-red px-3 text-sm font-black text-white"
            to="/admin"
          >
            Back to admin
          </AppLink>
        </section>
      </main>
    );
  }

  if (!ruleset) {
    return (
      <ResultShell fixture={fixture} stateLabel={stateLabel}>
        <p className="rounded-md border border-rooster-red/30 bg-rooster-red/10 px-3 py-2 text-sm font-bold text-rooster-red">
          This fixture has no published ruleset snapshot, so official result
          administration is unavailable.
        </p>
      </ResultShell>
    );
  }

  return (
    <ResultAdminEditor
      key={fixtureId}
      fixture={fixture}
      fixtureId={fixtureId}
      result={result}
      ruleset={ruleset}
      state={state}
      stateLabel={stateLabel}
    />
  );
};

const ResultAdminEditor = ({
  fixture,
  fixtureId,
  result,
  ruleset,
  state,
  stateLabel,
}: {
  readonly fixture: FixtureDocument;
  readonly fixtureId: string;
  readonly result: MatchResultDocument | undefined;
  readonly ruleset: RulesetSnapshot;
  readonly state: ReturnType<typeof matchResultAdminState>;
  readonly stateLabel: string;
}) => {
  const [form, setForm] = useState<ResultFormState>(() =>
    formFromResult(result, ruleset),
  );
  const [editSession, setEditSession] = useState<ResultEditSession>(() => ({
    expectedRevision: result?.revision ?? NO_MATCH_RESULT_REVISION,
    fixtureId,
  }));
  const [feedback, setFeedback] = useState<{
    readonly code?: string;
    readonly kind: 'error' | 'success';
    readonly message: string;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<'confirm' | 'save' | null>(
    null,
  );
  const isReadOnly =
    state === 'final' ||
    fixture.isCancelled === true ||
    fixture.visibility !== 'published';
  const isConflict = feedback?.code === 'result-conflict';

  const reloadLatest = () => {
    setForm(formFromResult(result, ruleset));
    setEditSession({
      expectedRevision: result?.revision ?? NO_MATCH_RESULT_REVISION,
      fixtureId,
    });
    setFeedback({
      kind: 'success',
      message: 'Latest result loaded. Unsaved values were replaced.',
    });
  };

  const submit = async (
    event: FormEvent<HTMLFormElement>,
    action: 'confirm' | 'save',
  ) => {
    event.preventDefault();

    if (
      action === 'confirm' &&
      !window.confirm(
        'Confirm this final result? Final results are read-only in this milestone and cannot be changed here.',
      )
    ) {
      return;
    }

    setFeedback(null);
    setPendingAction(action);

    try {
      const resultMutation = await callMeteorMethod<MatchResultMutationResult>(
        action === 'confirm'
          ? MATCH_RESULT_METHODS.confirmFinal
          : MATCH_RESULT_METHODS.saveProvisional,
        {
          expectedRevision: editSession.expectedRevision,
          fixtureId,
          observations: buildObservationPayload(form, ruleset),
        },
      );

      setEditSession({
        expectedRevision: resultMutation.revision,
        fixtureId,
      });
      setFeedback({
        kind: 'success',
        message:
          action === 'confirm'
            ? 'Final result confirmed.'
            : 'Provisional result saved.',
      });
    } catch (error) {
      setFeedback({
        code: codeFromError(error),
        kind: 'error',
        message: messageFromError(error),
      });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <ResultShell
      fixture={fixture}
      result={result}
      stateLabel={stateLabel}
      revision={editSession.expectedRevision}
    >
      {feedback ? (
        <div
          className={[
            'mb-4 rounded-md border px-3 py-2 text-sm font-bold',
            feedback.kind === 'success'
              ? 'border-rooster-grass/30 bg-rooster-grass/10 text-rooster-grass'
              : 'border-rooster-red/30 bg-rooster-red/10 text-rooster-red',
          ].join(' ')}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
        >
          <p>{feedback.message}</p>
          {isConflict ? (
            <button
              className="focus-ring mt-3 min-h-10 rounded-md border border-rooster-red/30 px-3 text-sm font-black text-rooster-red"
              type="button"
              onClick={reloadLatest}
            >
              Reload latest result
            </button>
          ) : null}
        </div>
      ) : null}

      {isReadOnly ? (
        <ReadOnlyResultSummary
          fixture={fixture}
          result={result}
          ruleset={ruleset}
        />
      ) : (
        <form
          className="grid gap-6"
          onSubmit={(event) => void submit(event, 'save')}
        >
          <DerivedScorePanel fixture={fixture} form={form} />

          <TeamObservationFields
            fixture={fixture}
            form={form}
            ruleset={ruleset}
            setForm={setForm}
          />

          <StandardCategoricalFields
            fixture={fixture}
            form={form}
            ruleset={ruleset}
            setForm={setForm}
          />

          <CustomSettlementFields
            form={form}
            ruleset={ruleset}
            setForm={setForm}
          />

          <div className="rounded-md border border-rooster-line bg-rooster-paper p-4">
            <h2 className="text-lg font-black text-rooster-ink">
              Final confirmation
            </h2>
            <p className="mt-2 text-sm leading-6 text-rooster-muted">
              Final confirmation requires every enabled built-in observation to
              be settled and every custom question to be settled or explicitly
              Void. Confirmation is read-only in this milestone.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="focus-ring inline-flex min-h-11 items-center rounded-md bg-rooster-red px-4 text-sm font-black text-white transition hover:bg-rooster-ink disabled:cursor-not-allowed disabled:opacity-60"
                disabled={Boolean(pendingAction)}
                type="submit"
              >
                {pendingAction === 'save'
                  ? 'Saving'
                  : 'Save provisional result'}
              </button>
              <button
                className="focus-ring inline-flex min-h-11 items-center rounded-md bg-rooster-grass px-4 text-sm font-black text-white transition hover:bg-rooster-ink disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  Boolean(pendingAction) ||
                  editSession.expectedRevision === NO_MATCH_RESULT_REVISION
                }
                type="button"
                onClick={(event) =>
                  void submit(
                    event as unknown as FormEvent<HTMLFormElement>,
                    'confirm',
                  )
                }
              >
                {pendingAction === 'confirm'
                  ? 'Confirming'
                  : 'Confirm final result'}
              </button>
            </div>
          </div>
        </form>
      )}
    </ResultShell>
  );
};

const ResultShell = ({
  children,
  fixture,
  result,
  revision,
  stateLabel,
}: {
  readonly children: React.ReactNode;
  readonly fixture: FixtureDocument;
  readonly result?: MatchResultDocument;
  readonly revision?: number;
  readonly stateLabel: string;
}) => (
  <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
    <section className="rounded-lg border border-white/10 bg-white p-6 text-rooster-ink sm:p-8">
      <AppLink
        className="focus-ring inline-flex min-h-10 items-center rounded-md text-sm font-black text-rooster-red"
        to="/admin"
      >
        Back to fixtures
      </AppLink>
      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-black uppercase text-rooster-red">
            Match results
          </p>
          <h1 className="mt-2 text-3xl font-black">
            {fixture.team1DisplayName} vs {fixture.team2DisplayName}
          </h1>
          <p className="mt-2 text-sm font-bold text-rooster-muted">
            {fixture.competitionDisplayName} · {kickoffLabel(fixture)}
          </p>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-md border border-rooster-line px-3 py-2">
            <dt className="font-black text-rooster-muted">Result state</dt>
            <dd className="mt-1 font-black text-rooster-ink">{stateLabel}</dd>
          </div>
          <div className="rounded-md border border-rooster-line px-3 py-2">
            <dt className="font-black text-rooster-muted">Revision</dt>
            <dd className="mt-1 font-black text-rooster-ink">
              {revision ?? result?.revision ?? NO_MATCH_RESULT_REVISION}
            </dd>
          </div>
        </dl>
      </div>
      {fixture.isCancelled ? (
        <p className="mt-5 rounded-md border border-rooster-red/30 bg-rooster-red/10 px-3 py-2 text-sm font-bold text-rooster-red">
          This fixture is cancelled. Existing result history is read-only.
        </p>
      ) : null}
      {fixture.visibility !== 'published' ? (
        <p className="mt-5 rounded-md border border-rooster-line bg-rooster-paper px-3 py-2 text-sm font-bold text-rooster-muted">
          Draft fixtures do not accept official result administration.
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  </main>
);

const DerivedScorePanel = ({
  fixture,
  form,
}: {
  readonly fixture: FixtureDocument;
  readonly form: ResultFormState;
}) => {
  const team1Score = derivedScore(form, 'team1');
  const team2Score = derivedScore(form, 'team2');
  const result =
    team1Score === null || team2Score === null
      ? 'Pending'
      : deriveMatchResult(team1Score, team2Score);
  const resultLabel =
    result === 'team1'
      ? fixture.team1DisplayName
      : result === 'team2'
        ? fixture.team2DisplayName
        : result === 'draw'
          ? 'Draw'
          : result;

  return (
    <section className="rounded-md border border-rooster-line p-4">
      <h2 className="text-lg font-black text-rooster-ink">
        Derived rugby score
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ScoreTile
          label={fixture.team1DisplayName}
          value={team1Score === null ? 'Pending' : String(team1Score)}
        />
        <ScoreTile
          label={fixture.team2DisplayName}
          value={team2Score === null ? 'Pending' : String(team2Score)}
        />
        <ScoreTile label="Derived result" value={resultLabel} />
      </div>
    </section>
  );
};

const ScoreTile = ({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) => (
  <div className="rounded-md border border-rooster-line bg-rooster-paper px-4 py-3">
    <p className="text-sm font-black text-rooster-muted">{label}</p>
    <p className="mt-1 text-2xl font-black text-rooster-ink">{value}</p>
  </div>
);

const TeamObservationFields = ({
  fixture,
  form,
  ruleset,
  setForm,
}: {
  readonly fixture: FixtureDocument;
  readonly form: ResultFormState;
  readonly ruleset: RulesetSnapshot;
  readonly setForm: React.Dispatch<React.SetStateAction<ResultFormState>>;
}) => {
  const fields = enabledTeamFields(ruleset);

  return (
    <section className="rounded-md border border-rooster-line p-4">
      <h2 className="text-lg font-black text-rooster-ink">Team observations</h2>
      <p className="mt-2 text-sm leading-6 text-rooster-muted">
        Blank means Pending. Zero is an observed zero. Penalty tries are entered
        as one try and one conversion.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {teamSides.map((side) => {
          const teamName =
            side === 'team1'
              ? fixture.team1DisplayName
              : fixture.team2DisplayName;

          return (
            <fieldset
              className="rounded-md border border-rooster-line p-4"
              key={side}
            >
              <legend className="px-1 text-sm font-black text-rooster-ink">
                {teamName}
              </legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                  <label
                    className="grid gap-2 text-sm font-bold text-rooster-ink"
                    key={field}
                  >
                    {teamName} {numericFieldLabels[field]}
                    <input
                      className="focus-ring min-h-11 rounded-md border border-rooster-line px-3 py-2 font-normal"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      type="number"
                      value={form[side][field]}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setForm((current) => ({
                          ...current,
                          [side]: {
                            ...current[side],
                            [field]: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
};

const StandardCategoricalFields = ({
  fixture,
  form,
  ruleset,
  setForm,
}: {
  readonly fixture: FixtureDocument;
  readonly form: ResultFormState;
  readonly ruleset: RulesetSnapshot;
  readonly setForm: React.Dispatch<React.SetStateAction<ResultFormState>>;
}) => (
  <section className="rounded-md border border-rooster-line p-4">
    <h2 className="text-lg font-black text-rooster-ink">
      Standard settlements
    </h2>
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      {isBuiltInEnabled(ruleset, 'first-try') ? (
        <SelectField
          label="First try"
          value={form.firstTry}
          options={[
            ['', 'Pending'],
            ['team1', fixture.team1DisplayName],
            ['team2', fixture.team2DisplayName],
            ['no-tries', 'No Tries Today!'],
          ]}
          onChange={(value) =>
            setForm((current) => ({ ...current, firstTry: value }))
          }
        />
      ) : null}
      {isBuiltInEnabled(ruleset, 'highest-scoring-half') ? (
        <SelectField
          label="Highest-scoring half"
          value={form.highestScoringHalf}
          options={[
            ['', 'Pending'],
            ['first', 'First Half'],
            ['second', 'Second Half'],
            ['equal', 'Equal Points'],
          ]}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              highestScoringHalf: value,
            }))
          }
        />
      ) : null}
      {isBuiltInEnabled(ruleset, 'half-time-leader') ? (
        <SelectField
          label="Half-time leader"
          value={form.halfTimeLeader}
          options={[
            ['', 'Pending'],
            ['team1', fixture.team1DisplayName],
            ['team2', fixture.team2DisplayName],
            ['draw', 'Half-time Draw'],
          ]}
          onChange={(value) =>
            setForm((current) => ({ ...current, halfTimeLeader: value }))
          }
        />
      ) : null}
    </div>
  </section>
);

const SelectField = ({
  label,
  onChange,
  options,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly (readonly [string, string])[];
  readonly value: string;
}) => (
  <label className="grid gap-2 text-sm font-bold text-rooster-ink">
    {label}
    <select
      className="focus-ring min-h-11 rounded-md border border-rooster-line px-3 py-2 font-normal"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue || 'pending'} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </select>
  </label>
);

const CustomSettlementFields = ({
  form,
  ruleset,
  setForm,
}: {
  readonly form: ResultFormState;
  readonly ruleset: RulesetSnapshot;
  readonly setForm: React.Dispatch<React.SetStateAction<ResultFormState>>;
}) => {
  const questions = customQuestions(ruleset);

  if (questions.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-rooster-line p-4">
      <h2 className="text-lg font-black text-rooster-ink">
        Custom settlements
      </h2>
      <div className="mt-4 grid gap-4">
        {questions.map((question) => {
          const answer = form.customAnswers[question.id] ?? {
            isVoid: false,
            value: '',
          };

          return (
            <fieldset
              className="rounded-md border border-rooster-line p-4"
              key={question.id}
            >
              <legend className="px-1 text-sm font-black text-rooster-ink">
                {question.prompt}
              </legend>
              {question.banter ? (
                <p className="mt-1 text-sm font-bold text-rooster-muted">
                  {question.banter}
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-6 text-rooster-muted">
                {question.countingDefinition}
              </p>
              <p className="mt-2 text-xs font-black uppercase text-rooster-muted">
                {question.type === 'custom-numeric'
                  ? `Prediction range ${question.min}-${question.max}. Deduction ${question.rate} per unit.`
                  : `Incorrect-answer deduction ${question.incorrectDeduction}.`}
              </p>
              <label className="mt-4 flex items-start gap-3 text-sm font-bold text-rooster-ink">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={answer.isVoid}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      customAnswers: {
                        ...current.customAnswers,
                        [question.id]: {
                          isVoid: event.target.checked,
                          value: '',
                        },
                      },
                    }))
                  }
                />
                <span>
                  Void question
                  {answer.isVoid ? (
                    <span className="block text-rooster-muted">
                      This question will deduct no points.
                    </span>
                  ) : null}
                </span>
              </label>
              {question.type === 'custom-numeric' ? (
                <label className="mt-4 grid gap-2 text-sm font-bold text-rooster-ink">
                  Official observed result
                  <input
                    className="focus-ring min-h-11 rounded-md border border-rooster-line px-3 py-2 font-normal disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={answer.isVoid}
                    inputMode="numeric"
                    min="0"
                    step="1"
                    type="number"
                    value={answer.value}
                    onChange={(event) =>
                      updateCustomAnswer(setForm, question.id, {
                        isVoid: false,
                        value: event.target.value,
                      })
                    }
                  />
                </label>
              ) : (
                <label className="mt-4 grid gap-2 text-sm font-bold text-rooster-ink">
                  Official correct answer
                  <select
                    className="focus-ring min-h-11 rounded-md border border-rooster-line px-3 py-2 font-normal disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={answer.isVoid}
                    value={answer.value}
                    onChange={(event) =>
                      updateCustomAnswer(setForm, question.id, {
                        isVoid: false,
                        value: event.target.value,
                      })
                    }
                  >
                    <option value="">Pending</option>
                    {question.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </fieldset>
          );
        })}
      </div>
    </section>
  );
};

const updateCustomAnswer = (
  setForm: React.Dispatch<React.SetStateAction<ResultFormState>>,
  questionId: string,
  answer: CustomResultFormValue,
) => {
  setForm((current) => ({
    ...current,
    customAnswers: {
      ...current.customAnswers,
      [questionId]: answer,
    },
  }));
};

const ReadOnlyResultSummary = ({
  fixture,
  result,
  ruleset,
}: {
  readonly fixture: FixtureDocument;
  readonly result: MatchResultDocument | undefined;
  readonly ruleset: RulesetSnapshot;
}) => {
  if (!result) {
    return (
      <p className="rounded-md border border-rooster-line bg-rooster-paper px-4 py-3 text-sm font-bold text-rooster-muted">
        No result has been saved for this fixture.
      </p>
    );
  }

  const team1Score = scoreFromObservations(result.observations, 'team1');
  const team2Score = scoreFromObservations(result.observations, 'team2');
  const matchResult =
    team1Score === null || team2Score === null
      ? 'Pending'
      : deriveMatchResult(team1Score, team2Score);
  const matchResultLabel =
    matchResult === 'team1'
      ? fixture.team1DisplayName
      : matchResult === 'team2'
        ? fixture.team2DisplayName
        : matchResult === 'draw'
          ? 'Draw'
          : matchResult;

  return (
    <section className="grid gap-5">
      <div className="rounded-md border border-rooster-line p-4">
        <h2 className="text-lg font-black text-rooster-ink">
          Confirmed result summary
        </h2>
        {result.confirmedAt ? (
          <p className="mt-2 text-sm font-bold text-rooster-muted">
            Confirmed {result.confirmedAt.toLocaleString()}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ScoreTile
            label={fixture.team1DisplayName}
            value={team1Score === null ? 'Pending' : String(team1Score)}
          />
          <ScoreTile
            label={fixture.team2DisplayName}
            value={team2Score === null ? 'Pending' : String(team2Score)}
          />
          <ScoreTile label="Derived result" value={matchResultLabel} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {teamSides.map((side) => (
          <TeamSummary
            fixture={fixture}
            key={side}
            observations={result.observations}
            ruleset={ruleset}
            side={side}
          />
        ))}
      </div>
      <StandardSummary fixture={fixture} result={result} ruleset={ruleset} />
      <CustomSummary result={result} ruleset={ruleset} />
    </section>
  );
};

const scoreFromObservations = (
  observations: FixtureObservations,
  side: TeamSide,
): number | null => {
  const team = observations[side];

  if (
    scoringComponentFields.some(
      (field) =>
        team[field]?.status === 'pending' || team[field]?.value === undefined,
    )
  ) {
    return null;
  }

  try {
    return deriveTeamScore({
      conversions: team.conversions?.value ?? 0,
      dropGoals: team.dropGoals?.value ?? 0,
      penaltyKicks: team.penaltyKicks?.value ?? 0,
      tries: team.tries?.value ?? 0,
    });
  } catch {
    return null;
  }
};

const TeamSummary = ({
  fixture,
  observations,
  ruleset,
  side,
}: {
  readonly fixture: FixtureDocument;
  readonly observations: FixtureObservations;
  readonly ruleset: RulesetSnapshot;
  readonly side: TeamSide;
}) => {
  const teamName =
    side === 'team1' ? fixture.team1DisplayName : fixture.team2DisplayName;

  return (
    <section className="rounded-md border border-rooster-line p-4">
      <h3 className="text-base font-black text-rooster-ink">{teamName}</h3>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {enabledTeamFields(ruleset).map((field) => {
          const observed = observations[side][field];

          return (
            <div key={field}>
              <dt className="text-xs font-black uppercase text-rooster-muted">
                {numericFieldLabels[field]}
              </dt>
              <dd className="mt-1 text-sm font-bold text-rooster-ink">
                {observed?.value ?? 'Pending'} · {observedStatusLabel(observed)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
};

const StandardSummary = ({
  fixture,
  result,
  ruleset,
}: {
  readonly fixture: FixtureDocument;
  readonly result: MatchResultDocument;
  readonly ruleset: RulesetSnapshot;
}) => {
  const standardRows: readonly (readonly [string, string])[] = [
    ...(isBuiltInEnabled(ruleset, 'first-try')
      ? [
          [
            'First try',
            firstTryLabel(result.observations.firstTry?.value, fixture),
          ] as const,
        ]
      : []),
    ...(isBuiltInEnabled(ruleset, 'highest-scoring-half')
      ? [
          [
            'Highest-scoring half',
            highestScoringHalfLabel(
              result.observations.highestScoringHalf?.value,
            ),
          ] as const,
        ]
      : []),
    ...(isBuiltInEnabled(ruleset, 'half-time-leader')
      ? [
          [
            'Half-time leader',
            leaderLabel(result.observations.halfTimeLeader?.value, fixture),
          ] as const,
        ]
      : []),
  ];

  if (standardRows.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-rooster-line p-4">
      <h3 className="text-base font-black text-rooster-ink">
        Standard settlements
      </h3>
      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        {standardRows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-black uppercase text-rooster-muted">
              {label}
            </dt>
            <dd className="mt-1 text-sm font-bold text-rooster-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

const CustomSummary = ({
  result,
  ruleset,
}: {
  readonly result: MatchResultDocument;
  readonly ruleset: RulesetSnapshot;
}) => {
  const questions = customQuestions(ruleset);

  if (questions.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-rooster-line p-4">
      <h3 className="text-base font-black text-rooster-ink">
        Custom settlements
      </h3>
      <dl className="mt-3 grid gap-3">
        {questions.map((question) => {
          const observed = result.observations.customAnswers?.[question.id];
          const value =
            observed?.status === 'void'
              ? 'Void. This question will deduct no points.'
              : observed?.status === 'pending'
                ? 'Pending'
                : customAnswerLabel(question, observed?.value);

          return (
            <div key={question.id}>
              <dt className="text-xs font-black uppercase text-rooster-muted">
                {question.prompt}
              </dt>
              <dd className="mt-1 text-sm font-bold text-rooster-ink">
                {value}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
};

const firstTryLabel = (
  value: string | undefined,
  fixture: FixtureDocument,
): string => {
  if (value === 'team1') {
    return fixture.team1DisplayName;
  }

  if (value === 'team2') {
    return fixture.team2DisplayName;
  }

  if (value === 'no-tries') {
    return 'No Tries Today!';
  }

  return 'Pending';
};

const highestScoringHalfLabel = (value: string | undefined): string => {
  if (value === 'first') {
    return 'First Half';
  }

  if (value === 'second') {
    return 'Second Half';
  }

  if (value === 'equal') {
    return 'Equal Points';
  }

  return 'Pending';
};

const leaderLabel = (
  value: string | undefined,
  fixture: FixtureDocument,
): string => {
  if (value === 'team1') {
    return fixture.team1DisplayName;
  }

  if (value === 'team2') {
    return fixture.team2DisplayName;
  }

  if (value === 'draw') {
    return 'Half-time Draw';
  }

  return 'Pending';
};

const customAnswerLabel = (
  question: Extract<
    QuestionDefinition,
    { readonly type: 'custom-numeric' | 'custom-categorical' }
  >,
  value: unknown,
): string => {
  if (question.type === 'custom-numeric') {
    return typeof value === 'number' ? String(value) : 'Pending';
  }

  return (
    question.options.find((option) => option.id === value)?.label ?? 'Pending'
  );
};
