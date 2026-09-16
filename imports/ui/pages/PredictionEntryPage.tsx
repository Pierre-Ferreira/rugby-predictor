import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';

import { Fixtures } from '/imports/api/fixtures/collection';
import { Predictions } from '/imports/api/predictions/collection';
import { signInPathForReturnTo } from '/imports/shared/auth/redirects';
import {
  FIXTURE_PUBLICATIONS,
  type FixtureDocument,
} from '/imports/shared/fixtures';
import {
  PREDICTION_METHODS,
  PREDICTION_PUBLICATIONS,
  type PredictionEntryDocument,
  type PredictionMutationResult,
} from '/imports/shared/predictions';
import {
  deriveMatchResult,
  deriveTeamScore,
  enabledQuestions,
  isBuiltInEnabled,
  ScoringValidationError,
  type FixturePrediction,
  type MatchResult,
  type QuestionDefinition,
  type RulesetSnapshot,
  type TeamSide,
  type TeamPrediction,
} from '/imports/shared/scoring';
import { callMeteorMethod } from '../auth/methodCall';
import { useAuthState } from '../auth/useAuthState';
import { SignInRequiredState } from '../components/AuthStates';
import { AppLink } from '../components/AppLink';
import {
  fixtureDetailPath,
  fixtureStatusClassName,
  fixtureStatusLabel,
  kickoffLabel,
} from '../fixtures/fixtureUi';

interface TeamPredictionForm {
  readonly conversions: string;
  readonly dropGoals: string;
  readonly penaltyKicks: string;
  readonly redCards: string;
  readonly tries: string;
  readonly yellowCards: string;
}

interface PredictionFormState {
  readonly customAnswers: Record<string, string>;
  readonly firstTry: string;
  readonly halfTimeLeader: string;
  readonly highestScoringHalf: string;
  readonly matchResult: string;
  readonly team1: TeamPredictionForm;
  readonly team2: TeamPredictionForm;
}

interface PredictionEditSession {
  readonly expectedRevision: number | null;
  readonly fixtureId: string;
  readonly userId: string;
}

const refreshIntervalMs = 15_000;

const fixtureIdFromLocation = (): string =>
  window.location.pathname.split('/').filter(Boolean)[1] ?? '';

const emptyTeamForm = (): TeamPredictionForm => ({
  conversions: '0',
  dropGoals: '0',
  penaltyKicks: '0',
  redCards: '0',
  tries: '0',
  yellowCards: '0',
});

const emptyFormForRuleset = (
  ruleset: RulesetSnapshot,
): PredictionFormState => ({
  customAnswers: Object.fromEntries(
    enabledQuestions(ruleset)
      .filter(
        (question) =>
          question.type === 'custom-numeric' ||
          question.type === 'custom-categorical',
      )
      .map((question) => [question.id, '']),
  ),
  firstTry: '',
  halfTimeLeader: '',
  highestScoringHalf: '',
  matchResult: '',
  team1: emptyTeamForm(),
  team2: emptyTeamForm(),
});

const stringFromNumber = (value: number | undefined): string =>
  value === undefined ? '0' : String(value);

const formFromPrediction = (
  prediction: FixturePrediction,
  ruleset: RulesetSnapshot,
): PredictionFormState => ({
  customAnswers: Object.fromEntries(
    enabledQuestions(ruleset)
      .filter(
        (question) =>
          question.type === 'custom-numeric' ||
          question.type === 'custom-categorical',
      )
      .map((question) => [
        question.id,
        prediction.customAnswers?.[question.id] === undefined
          ? ''
          : String(prediction.customAnswers[question.id]),
      ]),
  ),
  firstTry: prediction.firstTry ?? '',
  halfTimeLeader: prediction.halfTimeLeader ?? '',
  highestScoringHalf: prediction.highestScoringHalf ?? '',
  matchResult: prediction.matchResult ?? '',
  team1: {
    conversions: stringFromNumber(prediction.team1.conversions),
    dropGoals: stringFromNumber(prediction.team1.dropGoals),
    penaltyKicks: stringFromNumber(prediction.team1.penaltyKicks),
    redCards: stringFromNumber(prediction.team1.redCards),
    tries: stringFromNumber(prediction.team1.tries),
    yellowCards: stringFromNumber(prediction.team1.yellowCards),
  },
  team2: {
    conversions: stringFromNumber(prediction.team2.conversions),
    dropGoals: stringFromNumber(prediction.team2.dropGoals),
    penaltyKicks: stringFromNumber(prediction.team2.penaltyKicks),
    redCards: stringFromNumber(prediction.team2.redCards),
    tries: stringFromNumber(prediction.team2.tries),
    yellowCards: stringFromNumber(prediction.team2.yellowCards),
  },
});

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

  return 'The prediction could not be saved.';
};

const parseFormWholeNumber = (value: string): number | null => {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
};

const parseWholeNumber = (value: string, label: string): number => {
  const parsed = parseFormWholeNumber(value);

  if (parsed === null) {
    if (/^\d+$/.test(value.trim())) {
      throw new Error(`${label} is too large.`);
    }

    throw new Error(`${label} must be a whole number of 0 or more.`);
  }

  return parsed;
};

const clampWholeNumberToMaximum = (value: string, maximum: number): string => {
  const parsed = parseFormWholeNumber(value);

  if (parsed === null) {
    return value;
  }

  return String(Math.min(parsed, maximum));
};

const maxAttributeForWholeNumber = (value: string): string | undefined => {
  const parsed = parseFormWholeNumber(value);

  return parsed === null ? undefined : String(parsed);
};

const teamDisplayName = (fixture: FixtureDocument, side: TeamSide): string =>
  side === 'team1' ? fixture.team1DisplayName : fixture.team2DisplayName;

const parseWholeNumberForTeam = (
  value: string,
  fixture: FixtureDocument,
  side: TeamSide,
  label: string,
): number =>
  parseWholeNumber(value, `${teamDisplayName(fixture, side)} ${label}`);

const scoreUnavailableReason = (error: unknown): string => {
  if (error instanceof ScoringValidationError) {
    return error.issues[0]?.message ?? 'Enter valid scoring totals.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Enter valid scoring totals.';
};

const matchResultLabel = (fixture: FixtureDocument, value: string): string => {
  if (value === 'team1') {
    return teamDisplayName(fixture, 'team1');
  }

  if (value === 'team2') {
    return teamDisplayName(fixture, 'team2');
  }

  if (value === 'draw') {
    return 'Draw';
  }

  return 'Not selected';
};

const firstTryLabel = (fixture: FixtureDocument, value: string): string => {
  if (value === 'no-tries') {
    return 'No tries';
  }

  return matchResultLabel(fixture, value);
};

const highestHalfLabel = (value: string): string => {
  if (value === 'first') {
    return 'First half';
  }

  if (value === 'second') {
    return 'Second half';
  }

  if (value === 'equal') {
    return 'Equal points';
  }

  return 'Not selected';
};

const isCustomQuestion = (
  question: QuestionDefinition,
): question is Extract<
  QuestionDefinition,
  { readonly type: 'custom-categorical' | 'custom-numeric' }
> =>
  question.type === 'custom-categorical' || question.type === 'custom-numeric';

const buildPredictionPayload = (
  form: PredictionFormState,
  ruleset: RulesetSnapshot,
  fixture: FixtureDocument,
): FixturePrediction => {
  const teamPayload = (
    team: TeamPredictionForm,
    label: string,
  ): TeamPrediction => ({
    conversions: parseWholeNumber(team.conversions, `${label} conversions`),
    dropGoals: parseWholeNumber(team.dropGoals, `${label} drop goals`),
    penaltyKicks: parseWholeNumber(team.penaltyKicks, `${label} penalty kicks`),
    ...(isBuiltInEnabled(ruleset, 'red-cards')
      ? {
          redCards: parseWholeNumber(team.redCards, `${label} red cards`),
        }
      : {}),
    tries: parseWholeNumber(team.tries, `${label} tries`),
    ...(isBuiltInEnabled(ruleset, 'yellow-cards')
      ? {
          yellowCards: parseWholeNumber(
            team.yellowCards,
            `${label} yellow cards`,
          ),
        }
      : {}),
  });

  const customQuestions = enabledQuestions(ruleset).filter(isCustomQuestion);

  return {
    ...(isBuiltInEnabled(ruleset, 'match-result')
      ? {
          matchResult: form.matchResult as FixturePrediction['matchResult'],
        }
      : {}),
    ...(isBuiltInEnabled(ruleset, 'first-try')
      ? { firstTry: form.firstTry as FixturePrediction['firstTry'] }
      : {}),
    ...(isBuiltInEnabled(ruleset, 'highest-scoring-half')
      ? {
          highestScoringHalf:
            form.highestScoringHalf as FixturePrediction['highestScoringHalf'],
        }
      : {}),
    ...(isBuiltInEnabled(ruleset, 'half-time-leader')
      ? {
          halfTimeLeader:
            form.halfTimeLeader as FixturePrediction['halfTimeLeader'],
        }
      : {}),
    ...(customQuestions.length > 0
      ? {
          customAnswers: Object.fromEntries(
            customQuestions.map((question) => {
              const rawValue = form.customAnswers[question.id] ?? '';
              const value =
                question.type === 'custom-numeric'
                  ? parseWholeNumber(rawValue, question.label)
                  : rawValue;

              return [question.id, value];
            }),
          ),
        }
      : {}),
    team1: teamPayload(form.team1, teamDisplayName(fixture, 'team1')),
    team2: teamPayload(form.team2, teamDisplayName(fixture, 'team2')),
  };
};

export const PredictionEntryPage = () => {
  const fixtureId = fixtureIdFromLocation();
  const auth = useAuthState();
  const [now, setNow] = useState(() => new Date().getTime());

  const { entry, fixture, isConnected, isEntryReady, isFixtureReady } =
    useTracker(() => {
      const publicFixtureHandle = Meteor.subscribe(
        FIXTURE_PUBLICATIONS.publicDetail,
        fixtureId,
      );
      const userId = Meteor.userId();
      const privateFixtureHandle = userId
        ? Meteor.subscribe(PREDICTION_PUBLICATIONS.fixtureContext, fixtureId)
        : null;
      const entryHandle = userId
        ? Meteor.subscribe(PREDICTION_PUBLICATIONS.currentUserEntry, fixtureId)
        : null;

      return {
        entry: userId
          ? Predictions.findOne({
              fixtureId,
              userId,
            })
          : null,
        fixture: Fixtures.findOne({
          _id: fixtureId,
          visibility: 'published',
        }),
        isConnected: Meteor.status().connected,
        isEntryReady: entryHandle?.ready() ?? true,
        isFixtureReady:
          publicFixtureHandle.ready() &&
          (privateFixtureHandle?.ready() ?? true),
      };
    }, [fixtureId, auth.userId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date().getTime());
    }, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, []);

  const ruleset = fixture?.rulesetSnapshot;
  const isLockedByKickoff = fixture
    ? now >= fixture.scheduledKickoffAt.getTime()
    : false;
  const isReadOnly = Boolean(fixture?.isCancelled || isLockedByKickoff);

  if (!isConnected && !isFixtureReady) {
    return (
      <PredictionShell>
        <section
          className="rounded-md border border-rooster-red/30 bg-white p-6"
          role="status"
        >
          <h1 className="text-2xl font-black text-rooster-ink">
            Prediction page is unavailable right now
          </h1>
          <p className="mt-2 text-sm leading-6 text-rooster-muted">
            Reconnect to Rugby Rooster to load this fixture.
          </p>
        </section>
      </PredictionShell>
    );
  }

  if (!isFixtureReady || auth.isLoading) {
    return (
      <PredictionShell>
        <section
          className="rounded-md border border-rooster-line bg-white p-6"
          role="status"
        >
          <p className="text-sm font-bold text-rooster-muted">
            Loading prediction page
          </p>
        </section>
      </PredictionShell>
    );
  }

  if (!fixture) {
    return (
      <PredictionShell>
        <section className="rounded-md border border-dashed border-rooster-line bg-white p-6">
          <p className="text-sm font-black uppercase text-rooster-red">
            Predictions
          </p>
          <h1 className="mt-3 text-2xl font-black text-rooster-ink">
            Fixture not found
          </h1>
          <p className="mt-3 text-sm leading-6 text-rooster-muted">
            Draft fixtures and unknown fixture links are not available for
            prediction entry.
          </p>
          <AppLink
            className="focus-ring mt-5 inline-flex min-h-11 items-center rounded-md bg-rooster-ink px-4 text-sm font-black text-white transition hover:bg-rooster-red"
            to="/games"
          >
            Back to games
          </AppLink>
        </section>
      </PredictionShell>
    );
  }

  const fixtureTitle = `${fixture.team1DisplayName} vs ${fixture.team2DisplayName}`;

  if (!auth.isAuthenticated || !auth.isVerified) {
    return (
      <PredictionShell>
        <FixtureHeader
          fixture={fixture}
          isLockedByKickoff={isLockedByKickoff}
        />
        <SignInRequiredState
          currentPath={window.location.pathname}
          message="Sign in with the existing email-link flow to save or revisit your prediction for this fixture."
          signInPath={signInPathForReturnTo(window.location.pathname)}
          title={`Predict ${fixtureTitle}`}
        />
      </PredictionShell>
    );
  }

  if (!ruleset) {
    return (
      <PredictionShell>
        <FixtureHeader
          fixture={fixture}
          isLockedByKickoff={isLockedByKickoff}
        />
        <section
          className="rounded-md border border-rooster-red/30 bg-white p-6"
          role="alert"
        >
          <h1 className="text-2xl font-black text-rooster-ink">
            Prediction rules unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-rooster-muted">
            This fixture cannot accept predictions because its stored ruleset
            snapshot is missing.
          </p>
        </section>
      </PredictionShell>
    );
  }

  if (!isEntryReady) {
    return (
      <PredictionShell>
        <FixtureHeader
          fixture={fixture}
          isLockedByKickoff={isLockedByKickoff}
        />
        <section
          className="rounded-md border border-rooster-line bg-white p-6"
          role="status"
        >
          <p className="text-sm font-bold text-rooster-muted">
            Loading saved prediction
          </p>
        </section>
      </PredictionShell>
    );
  }

  const readOnlyReason = fixture.isCancelled
    ? 'This fixture has been cancelled, so predictions are read-only.'
    : isLockedByKickoff
      ? 'Scheduled kickoff has passed, so predictions are read-only.'
      : null;

  const initialForm = entry
    ? formFromPrediction(entry.prediction, ruleset)
    : emptyFormForRuleset(ruleset);
  const userId = auth.userId ?? '';

  return (
    <PredictionEntrySession
      key={`${userId}:${fixtureId}`}
      currentEntry={entry}
      fixture={fixture}
      fixtureId={fixtureId}
      initialExpectedRevision={entry?.revision ?? null}
      initialForm={initialForm}
      isReadOnly={isReadOnly}
      readOnlyReason={readOnlyReason}
      ruleset={ruleset}
      userId={userId}
    />
  );
};

const PredictionEntrySession = ({
  currentEntry,
  fixture,
  fixtureId,
  initialExpectedRevision,
  initialForm,
  isReadOnly,
  readOnlyReason,
  ruleset,
  userId,
}: {
  readonly currentEntry: PredictionEntryDocument | null | undefined;
  readonly fixture: FixtureDocument;
  readonly fixtureId: string;
  readonly initialExpectedRevision: number | null;
  readonly initialForm: PredictionFormState;
  readonly isReadOnly: boolean;
  readonly readOnlyReason: string | null;
  readonly ruleset: RulesetSnapshot;
  readonly userId: string;
}) => {
  const [form, setForm] = useState(initialForm);
  const [editSession, setEditSession] = useState<PredictionEditSession>({
    expectedRevision: initialExpectedRevision,
    fixtureId,
    userId,
  });
  const [feedback, setFeedback] = useState<{
    readonly code?: string;
    readonly kind: 'error' | 'success';
    readonly message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const savedEntryChanged =
    currentEntry &&
    editSession.expectedRevision !== null &&
    currentEntry.revision !== editSession.expectedRevision;

  const reloadFromSavedEntry = () => {
    setForm(
      currentEntry
        ? formFromPrediction(currentEntry.prediction, ruleset)
        : emptyFormForRuleset(ruleset),
    );
    setEditSession({
      expectedRevision: currentEntry?.revision ?? null,
      fixtureId,
      userId,
    });
    setFeedback({
      kind: 'success',
      message: currentEntry
        ? 'Saved prediction loaded. Unsaved values were replaced.'
        : 'Blank prediction form loaded. Unsaved values were replaced.',
    });
  };

  const updateTeamField =
    (side: TeamSide, field: keyof TeamPredictionForm) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;

      setForm((current) => {
        const nextTeam = {
          ...current[side],
          [field]: value,
        };

        if (field === 'tries') {
          const tries = parseFormWholeNumber(value);
          const conversions = parseFormWholeNumber(nextTeam.conversions);

          if (tries !== null && conversions !== null && conversions > tries) {
            nextTeam.conversions = clampWholeNumberToMaximum(
              nextTeam.conversions,
              tries,
            );
          }
        }

        if (field === 'conversions') {
          const tries = parseFormWholeNumber(nextTeam.tries);
          const conversions = parseFormWholeNumber(value);

          if (tries !== null && conversions !== null && conversions > tries) {
            nextTeam.conversions = clampWholeNumberToMaximum(value, tries);
          }
        }

        return {
          ...current,
          [side]: nextTeam,
        };
      });
    };

  const updateField =
    (
      field: keyof Omit<
        PredictionFormState,
        'customAnswers' | 'team1' | 'team2'
      >,
    ) =>
    (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const updateCustomAnswer =
    (questionId: string) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((current) => ({
        ...current,
        customAnswers: {
          ...current.customAnswers,
          [questionId]: event.target.value,
        },
      }));
    };

  const submitPrediction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isReadOnly) {
      return;
    }

    setFeedback(null);
    setIsSubmitting(true);

    try {
      const prediction = buildPredictionPayload(form, ruleset, fixture);
      const result = await callMeteorMethod<PredictionMutationResult>(
        PREDICTION_METHODS.submit,
        {
          ...(editSession.expectedRevision === null
            ? {}
            : { expectedRevision: editSession.expectedRevision }),
          fixtureId,
          prediction,
        },
      );

      setEditSession({
        expectedRevision: result.revision,
        fixtureId,
        userId,
      });
      setFeedback({
        kind: 'success',
        message:
          result.status === 'created'
            ? 'Prediction saved.'
            : 'Prediction updated.',
      });
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
      setIsSubmitting(false);
    }
  };

  return (
    <PredictionShell>
      <FixtureHeader fixture={fixture} isLockedByKickoff={isReadOnly} />

      {feedback ? (
        <div
          className={[
            'rounded-md border p-4 text-sm font-semibold',
            feedback.kind === 'success'
              ? 'border-rooster-grass/30 bg-rooster-grass/10 text-rooster-ink'
              : 'border-rooster-red/30 bg-rooster-red/10 text-rooster-ink',
          ].join(' ')}
          role={feedback.kind === 'success' ? 'status' : 'alert'}
        >
          {feedback.message}
          {feedback.code === 'prediction-conflict' ? (
            <div className="mt-3">
              <p>
                This form still uses revision{' '}
                {editSession.expectedRevision ?? 'new'}.
              </p>
              <button
                className="focus-ring mt-3 min-h-10 rounded-md border border-rooster-line bg-white px-3 text-sm font-black text-rooster-ink transition hover:bg-rooster-paper"
                type="button"
                onClick={reloadFromSavedEntry}
              >
                Reload saved entry
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {savedEntryChanged && feedback?.code !== 'prediction-conflict' ? (
        <div
          className="rounded-md border border-rooster-line bg-white p-4 text-sm text-rooster-muted"
          role="status"
        >
          Your saved prediction changed in another session. This form still uses
          revision {editSession.expectedRevision}; reload saved entry to replace
          your unsaved values.
          <div className="mt-3">
            <button
              className="focus-ring min-h-10 rounded-md border border-rooster-line bg-white px-3 text-sm font-black text-rooster-ink transition hover:bg-rooster-paper"
              type="button"
              onClick={reloadFromSavedEntry}
            >
              Reload saved entry
            </button>
          </div>
        </div>
      ) : null}

      {readOnlyReason ? (
        <ReadOnlyPrediction
          entry={currentEntry}
          fixture={fixture}
          reason={readOnlyReason}
          ruleset={ruleset}
        />
      ) : (
        <form
          className="grid gap-5"
          onSubmit={(event) => void submitPrediction(event)}
        >
          <PredictionFields
            fixture={fixture}
            form={form}
            ruleset={ruleset}
            updateCustomAnswer={updateCustomAnswer}
            updateField={updateField}
            updateTeamField={updateTeamField}
          />

          <PredictionReview fixture={fixture} form={form} ruleset={ruleset} />

          <div className="rounded-md border border-rooster-line bg-white p-5">
            <p className="text-sm leading-6 text-rooster-muted">
              {editSession.expectedRevision === null
                ? 'This will create your prediction for the fixture.'
                : `This revision started from saved entry revision ${editSession.expectedRevision}.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md bg-rooster-red px-5 text-base font-black text-white transition hover:bg-rooster-ink disabled:cursor-not-allowed disabled:bg-rooster-muted sm:w-auto"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? 'Saving prediction'
                  : editSession.expectedRevision === null
                    ? 'Submit prediction'
                    : 'Save revised prediction'}
              </button>
              <button
                className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md border border-rooster-line bg-white px-5 text-base font-black text-rooster-ink transition hover:bg-rooster-paper sm:w-auto"
                disabled={isSubmitting}
                type="button"
                onClick={reloadFromSavedEntry}
              >
                Reload saved entry
              </button>
            </div>
          </div>
        </form>
      )}
    </PredictionShell>
  );
};

const PredictionShell = ({ children }: { readonly children: ReactNode }) => (
  <main className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-10 sm:px-6">
    {children}
  </main>
);

const FixtureHeader = ({
  fixture,
  isLockedByKickoff,
}: {
  readonly fixture: FixtureDocument;
  readonly isLockedByKickoff: boolean;
}) => (
  <section className="rounded-md border border-rooster-line bg-white p-6 sm:p-8">
    <AppLink
      className="focus-ring inline-flex min-h-10 items-center rounded-md text-sm font-black text-rooster-red"
      to={fixtureDetailPath(fixture._id)}
    >
      Back to fixture
    </AppLink>
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span
        className={[
          'inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase',
          fixtureStatusClassName(fixture),
        ].join(' ')}
      >
        {fixtureStatusLabel(fixture)}
      </span>
      <span className="text-xs font-bold uppercase text-rooster-muted">
        {isLockedByKickoff ? 'Locked' : 'Open before kickoff'}
      </span>
      <span className="text-xs font-bold uppercase text-rooster-muted">
        {fixture.competitionDisplayName}
      </span>
    </div>
    <h1 className="mt-4 text-3xl font-black text-rooster-ink sm:text-4xl">
      {fixture.team1DisplayName} vs {fixture.team2DisplayName}
    </h1>
    <p className="mt-3 text-sm font-bold text-rooster-muted">
      Kickoff: {kickoffLabel(fixture)}
    </p>
  </section>
);

interface PredictionFieldsProps {
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly ruleset: RulesetSnapshot;
  readonly updateCustomAnswer: (
    questionId: string,
  ) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  readonly updateField: (
    field: keyof Omit<PredictionFormState, 'customAnswers' | 'team1' | 'team2'>,
  ) => (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => void;
  readonly updateTeamField: (
    side: TeamSide,
    field: keyof TeamPredictionForm,
  ) => (event: ChangeEvent<HTMLInputElement>) => void;
}

const PredictionFields = ({
  fixture,
  form,
  ruleset,
  updateCustomAnswer,
  updateField,
  updateTeamField,
}: PredictionFieldsProps) => (
  <>
    <fieldset className="rounded-md border border-rooster-line bg-white p-5">
      <legend className="px-1 text-lg font-black text-rooster-ink">
        Scoring totals
      </legend>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {(['team1', 'team2'] as const).map((side) => (
          <TeamFields
            fixture={fixture}
            form={form[side]}
            key={side}
            ruleset={ruleset}
            side={side}
            updateTeamField={updateTeamField}
          />
        ))}
      </div>
    </fieldset>

    <fieldset className="rounded-md border border-rooster-line bg-white p-5">
      <legend className="px-1 text-lg font-black text-rooster-ink">
        Match calls
      </legend>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {isBuiltInEnabled(ruleset, 'match-result') ? (
          <SelectField
            label="Match result"
            onChange={updateField('matchResult')}
            options={[
              ['', 'Select result'],
              ['team1', teamDisplayName(fixture, 'team1')],
              ['team2', teamDisplayName(fixture, 'team2')],
              ['draw', 'Draw'],
            ]}
            value={form.matchResult}
          />
        ) : null}
        {isBuiltInEnabled(ruleset, 'first-try') ? (
          <SelectField
            label="First try"
            onChange={updateField('firstTry')}
            options={[
              ['', 'Select first try'],
              ['team1', teamDisplayName(fixture, 'team1')],
              ['team2', teamDisplayName(fixture, 'team2')],
              ['no-tries', 'No tries'],
            ]}
            value={form.firstTry}
          />
        ) : null}
        {isBuiltInEnabled(ruleset, 'highest-scoring-half') ? (
          <SelectField
            label="Highest-scoring half"
            onChange={updateField('highestScoringHalf')}
            options={[
              ['', 'Select half'],
              ['first', 'First half'],
              ['second', 'Second half'],
              ['equal', 'Equal points'],
            ]}
            value={form.highestScoringHalf}
          />
        ) : null}
        {isBuiltInEnabled(ruleset, 'half-time-leader') ? (
          <SelectField
            label="Half-time leader"
            onChange={updateField('halfTimeLeader')}
            options={[
              ['', 'Select leader'],
              ['team1', teamDisplayName(fixture, 'team1')],
              ['team2', teamDisplayName(fixture, 'team2')],
              ['draw', 'Draw'],
            ]}
            value={form.halfTimeLeader}
          />
        ) : null}
      </div>
    </fieldset>

    <CustomQuestionFields
      form={form}
      ruleset={ruleset}
      updateCustomAnswer={updateCustomAnswer}
    />
  </>
);

const TeamFields = ({
  fixture,
  form,
  ruleset,
  side,
  updateTeamField,
}: {
  readonly fixture: FixtureDocument;
  readonly form: TeamPredictionForm;
  readonly ruleset: RulesetSnapshot;
  readonly side: TeamSide;
  readonly updateTeamField: PredictionFieldsProps['updateTeamField'];
}) => {
  const teamName = teamDisplayName(fixture, side);
  const conversionMaximum = maxAttributeForWholeNumber(form.tries);

  return (
    <div className="rounded-md border border-rooster-line bg-rooster-paper p-4">
      <h2 className="text-base font-black text-rooster-ink">{teamName}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <NumericField
          inputLabel={`${teamName} tries`}
          label="Tries"
          onChange={updateTeamField(side, 'tries')}
          value={form.tries}
        />
        <NumericField
          inputLabel={`${teamName} conversions`}
          label="Conversions"
          max={conversionMaximum}
          onChange={updateTeamField(side, 'conversions')}
          value={form.conversions}
        />
        <NumericField
          inputLabel={`${teamName} penalty kicks`}
          label="Penalty kicks"
          onChange={updateTeamField(side, 'penaltyKicks')}
          value={form.penaltyKicks}
        />
        <NumericField
          inputLabel={`${teamName} drop goals`}
          label="Drop goals"
          onChange={updateTeamField(side, 'dropGoals')}
          value={form.dropGoals}
        />
        {isBuiltInEnabled(ruleset, 'yellow-cards') ? (
          <NumericField
            inputLabel={`${teamName} yellow cards`}
            label="Yellow cards"
            onChange={updateTeamField(side, 'yellowCards')}
            value={form.yellowCards}
          />
        ) : null}
        {isBuiltInEnabled(ruleset, 'red-cards') ? (
          <NumericField
            inputLabel={`${teamName} red cards`}
            label="Red cards"
            onChange={updateTeamField(side, 'redCards')}
            value={form.redCards}
          />
        ) : null}
      </div>
    </div>
  );
};

const NumericField = ({
  inputLabel,
  label,
  max,
  onChange,
  value,
}: {
  readonly inputLabel?: string;
  readonly label: string;
  readonly max?: string;
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly value: string;
}) => {
  const id = useId();

  return (
    <label className="block text-sm font-black text-rooster-ink" htmlFor={id}>
      {label}
      <input
        className="focus-ring mt-2 block min-h-11 w-full rounded-md border border-rooster-line bg-white px-3 text-base text-rooster-ink"
        aria-label={inputLabel}
        id={id}
        inputMode="numeric"
        max={max}
        min="0"
        onChange={onChange}
        pattern="[0-9]*"
        required
        step="1"
        type="number"
        value={value}
      />
    </label>
  );
};

const SelectField = ({
  label,
  onChange,
  options,
  value,
}: {
  readonly label: string;
  readonly onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly options: readonly (readonly [string, string])[];
  readonly value: string;
}) => {
  const id = useId();

  return (
    <label className="block text-sm font-black text-rooster-ink" htmlFor={id}>
      {label}
      <select
        className="focus-ring mt-2 block min-h-11 w-full rounded-md border border-rooster-line bg-white px-3 text-base text-rooster-ink"
        id={id}
        onChange={onChange}
        required
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
};

const CustomQuestionFields = ({
  form,
  ruleset,
  updateCustomAnswer,
}: {
  readonly form: PredictionFormState;
  readonly ruleset: RulesetSnapshot;
  readonly updateCustomAnswer: PredictionFieldsProps['updateCustomAnswer'];
}) => {
  const customQuestions = enabledQuestions(ruleset).filter(isCustomQuestion);

  if (customQuestions.length === 0) {
    return null;
  }

  return (
    <fieldset className="rounded-md border border-rooster-line bg-white p-5">
      <legend className="px-1 text-lg font-black text-rooster-ink">
        Fixture questions
      </legend>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {customQuestions.map((question) =>
          question.type === 'custom-numeric' ? (
            <NumericField
              key={question.id}
              label={question.label}
              onChange={updateCustomAnswer(question.id)}
              value={form.customAnswers[question.id] ?? ''}
            />
          ) : (
            <SelectField
              key={question.id}
              label={question.label}
              onChange={updateCustomAnswer(question.id)}
              options={[
                ['', 'Select answer'],
                ...question.options.map(
                  (option) => [option.id, option.label] as const,
                ),
              ]}
              value={form.customAnswers[question.id] ?? ''}
            />
          ),
        )}
      </div>
    </fieldset>
  );
};

const PredictionReview = ({
  fixture,
  form,
  ruleset,
}: {
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly ruleset: RulesetSnapshot;
}) => {
  const derived = deriveScoresFromForm(form, fixture);

  return (
    <section className="rounded-md border border-rooster-line bg-white p-5">
      <h2 className="text-lg font-black text-rooster-ink">Review</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReviewItem
          detail={derived.team1.message}
          label={teamDisplayName(fixture, 'team1')}
          value={
            derived.team1.score === null
              ? 'Predicted score unavailable'
              : `Predicted score: ${derived.team1.score}`
          }
        />
        <ReviewItem
          detail={derived.team2.message}
          label={teamDisplayName(fixture, 'team2')}
          value={
            derived.team2.score === null
              ? 'Predicted score unavailable'
              : `Predicted score: ${derived.team2.score}`
          }
        />
        <ReviewItem
          detail={derived.resultMessage}
          label="Derived result"
          value={
            derived.matchResult
              ? matchResultLabel(fixture, derived.matchResult)
              : 'Derived result unavailable'
          }
        />
        <ReviewItem
          label="Selected result"
          value={matchResultLabel(fixture, form.matchResult)}
        />
        {isBuiltInEnabled(ruleset, 'first-try') ? (
          <ReviewItem
            label="First try"
            value={firstTryLabel(fixture, form.firstTry)}
          />
        ) : null}
        {isBuiltInEnabled(ruleset, 'highest-scoring-half') ? (
          <ReviewItem
            label="Highest-scoring half"
            value={highestHalfLabel(form.highestScoringHalf)}
          />
        ) : null}
        {isBuiltInEnabled(ruleset, 'half-time-leader') ? (
          <ReviewItem
            label="Half-time leader"
            value={matchResultLabel(fixture, form.halfTimeLeader)}
          />
        ) : null}
      </dl>
    </section>
  );
};

const ReviewItem = ({
  detail,
  label,
  value,
}: {
  readonly detail?: string | null;
  readonly label: string;
  readonly value: string;
}) => (
  <div
    className="rounded-md border border-rooster-line bg-rooster-paper p-3"
    role="group"
    aria-label={`Review ${label}`}
  >
    <dt className="text-xs font-black uppercase text-rooster-muted">{label}</dt>
    <dd className="mt-1 text-sm font-black text-rooster-ink">{value}</dd>
    {detail ? (
      <p className="mt-1 text-xs font-semibold leading-5 text-rooster-muted">
        {detail}
      </p>
    ) : null}
  </div>
);

interface TeamScoreReview {
  readonly message: string | null;
  readonly score: number | null;
}

interface ScoreReview {
  readonly matchResult: MatchResult | null;
  readonly resultMessage: string | null;
  readonly team1: TeamScoreReview;
  readonly team2: TeamScoreReview;
}

const deriveScoresFromForm = (
  form: PredictionFormState,
  fixture: FixtureDocument,
): ScoreReview => {
  const team1 = deriveTeamScoreFromForm(form.team1, fixture, 'team1');
  const team2 = deriveTeamScoreFromForm(form.team2, fixture, 'team2');

  if (team1.score === null || team2.score === null) {
    return {
      matchResult: null,
      resultMessage: 'Enter valid scoring totals for both teams.',
      team1,
      team2,
    };
  }

  try {
    return {
      matchResult: deriveMatchResult(team1.score, team2.score),
      resultMessage: null,
      team1,
      team2,
    };
  } catch (error) {
    return {
      matchResult: null,
      resultMessage: scoreUnavailableReason(error),
      team1,
      team2,
    };
  }
};

const deriveTeamScoreFromForm = (
  form: TeamPredictionForm,
  fixture: FixtureDocument,
  side: TeamSide,
): TeamScoreReview => {
  try {
    return {
      message: null,
      score: deriveTeamScore({
        conversions: parseWholeNumberForTeam(
          form.conversions,
          fixture,
          side,
          'conversions',
        ),
        dropGoals: parseWholeNumberForTeam(
          form.dropGoals,
          fixture,
          side,
          'drop goals',
        ),
        penaltyKicks: parseWholeNumberForTeam(
          form.penaltyKicks,
          fixture,
          side,
          'penalty kicks',
        ),
        tries: parseWholeNumberForTeam(form.tries, fixture, side, 'tries'),
      }),
    };
  } catch (error) {
    return {
      message: scoreUnavailableReason(error),
      score: null,
    };
  }
};

const ReadOnlyPrediction = ({
  entry,
  fixture,
  reason,
  ruleset,
}: {
  readonly entry: PredictionEntryDocument | null | undefined;
  readonly fixture: FixtureDocument;
  readonly reason: string;
  readonly ruleset: RulesetSnapshot;
}) => {
  const savedForm = entry
    ? formFromPrediction(entry.prediction, ruleset)
    : null;

  return (
    <section className="rounded-md border border-rooster-line bg-white p-5">
      <h2 className="text-xl font-black text-rooster-ink">Saved prediction</h2>
      <p className="mt-2 text-sm leading-6 text-rooster-muted">{reason}</p>
      {entry && savedForm ? (
        <>
          <p className="mt-2 text-sm font-bold text-rooster-muted">
            Saved revision {entry.revision}.
          </p>
          <div className="mt-5">
            <PredictionReview
              fixture={fixture}
              form={savedForm}
              ruleset={ruleset}
            />
          </div>
        </>
      ) : (
        <p className="mt-5 rounded-md border border-dashed border-rooster-line bg-rooster-paper p-4 text-sm font-semibold text-rooster-muted">
          No saved prediction exists for this fixture.
        </p>
      )}
    </section>
  );
};
