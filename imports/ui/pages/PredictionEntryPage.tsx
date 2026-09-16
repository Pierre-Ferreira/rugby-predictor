import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
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
  activeCustomQuestions,
  activePredictionSteps,
  customChoiceDeductionText,
  customNumberDeductionText,
  editStepIdForCustomQuestion,
  editStepIdForReviewSection,
  firstPredictionStepId,
  isBuiltInPredictionStep,
  isFinalPredictionStep,
  isCustomPredictionStep,
  isScoreKnownAtStep,
  nextPredictionLocation,
  predictionIntroMessage,
  predictionStepPosition,
  previousPredictionLocation,
  resolvePredictionStepMessage,
  selectPredictionMessageVariants,
  type PredictionMessageVariantSelection,
  type PredictionReviewSectionId,
  type PredictionSequenceLocation,
  type PredictionSequenceStepDefinition,
  type PredictionStepId,
  PREDICTION_METHODS,
  PREDICTION_PUBLICATIONS,
  type PredictionEntryDocument,
  type PredictionMutationResult,
} from '/imports/shared/predictions';
import {
  isBuiltInEnabled,
  teamScoreComponentRugbyPoints,
  type FirstTryAnswer,
  type RulesetSnapshot,
  type TeamSide,
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
import {
  buildPredictionPayload,
  customAnswerDisplayValue,
  customQuestionById,
  customStepValidationMessage,
  deriveScoresFromForm,
  deriveTeamScoreFromForm,
  emptyFormForRuleset,
  enforceFirstTryConsistency,
  firstTryConstraintForForm,
  firstTryLabel,
  halfTimeLeaderLabel,
  formFromPrediction,
  highestHalfLabel,
  matchResultLabel,
  maxAttributeForWholeNumber,
  normalizeInitialPredictionForm,
  parseFormWholeNumber,
  resultConsistencyIssue,
  setTeamPredictionField,
  teamDisplayName,
  type ActiveCustomQuestion,
  type PredictionFormState,
  type TeamPredictionForm,
} from '../predictions/standardPredictionState';

interface PredictionEditSession {
  readonly expectedRevision: number | null;
  readonly fixtureId: string;
  readonly userId: string;
}

type PredictionStepRenderer = (props: PredictionStepContentProps) => ReactNode;

interface PredictionStepContentProps {
  readonly conversionAdjustmentNotice: string | null;
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly onChoiceChange: (field: ChoiceFieldName, value: string) => void;
  readonly onCustomAnswerChange: (questionId: string, value: string) => void;
  readonly onEditStep: (stepId: PredictionStepId) => void;
  readonly onTeamFieldChange: (
    side: TeamSide,
    field: keyof TeamPredictionForm,
    value: string,
  ) => void;
  readonly ruleset: RulesetSnapshot;
}

type ChoiceFieldName =
  'firstTry' | 'halfTimeLeader' | 'highestScoringHalf' | 'matchResult';

const refreshIntervalMs = 15_000;

const fixtureIdFromLocation = (): string =>
  window.location.pathname.split('/').filter(Boolean)[1] ?? '';

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

const PredictionShell = ({ children }: { readonly children: ReactNode }) => (
  <main className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-8 sm:px-6 lg:py-10">
    {children}
  </main>
);

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

  const initialForm = normalizeInitialPredictionForm(
    entry
      ? formFromPrediction(entry.prediction, ruleset)
      : emptyFormForRuleset(ruleset),
    ruleset,
  );
  const userId = auth.userId ?? '';

  return (
    <PredictionEntrySession
      key={`${userId}:${fixtureId}`}
      currentEntry={entry}
      fixture={fixture}
      fixtureId={fixtureId}
      initialExpectedRevision={entry?.revision ?? null}
      initialForm={initialForm}
      isLockedByKickoff={isLockedByKickoff}
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
  isLockedByKickoff,
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
  readonly isLockedByKickoff: boolean;
  readonly isReadOnly: boolean;
  readonly readOnlyReason: string | null;
  readonly ruleset: RulesetSnapshot;
  readonly userId: string;
}) => {
  const activeSteps = useMemo(() => activePredictionSteps(ruleset), [ruleset]);
  const firstStepId = firstPredictionStepId(activeSteps);
  const [form, setForm] = useState(initialForm);
  const [location, setLocation] = useState<PredictionSequenceLocation>(() =>
    initialExpectedRevision === null ? { kind: 'intro' } : { kind: 'review' },
  );
  const [messageSelection] = useState<PredictionMessageVariantSelection>(() =>
    selectPredictionMessageVariants(
      activeSteps.filter(isBuiltInPredictionStep).map((step) => step.messageId),
    ),
  );
  const [isEditingFromReview, setIsEditingFromReview] = useState(false);
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
  const [conversionAdjustmentNotice, setConversionAdjustmentNotice] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const savedEntryChanged =
    currentEntry &&
    editSession.expectedRevision !== null &&
    currentEntry.revision !== editSession.expectedRevision;
  const consistencyIssue = isBuiltInEnabled(ruleset, 'match-result')
    ? resultConsistencyIssue(form, fixture)
    : null;

  const reloadFromSavedEntry = () => {
    const nextForm = normalizeInitialPredictionForm(
      currentEntry
        ? formFromPrediction(currentEntry.prediction, ruleset)
        : emptyFormForRuleset(ruleset),
      ruleset,
    );

    setForm(nextForm);
    setEditSession({
      expectedRevision: currentEntry?.revision ?? null,
      fixtureId,
      userId,
    });
    setLocation(currentEntry ? { kind: 'review' } : { kind: 'intro' });
    setIsEditingFromReview(false);
    setFeedback({
      kind: 'success',
      message: currentEntry
        ? 'Saved prediction loaded. Unsaved values were replaced.'
        : 'Blank prediction form loaded. Unsaved values were replaced.',
    });
    setConversionAdjustmentNotice(null);
  };

  const goToFirstStep = () => {
    setIsEditingFromReview(false);
    setLocation(
      firstStepId
        ? { kind: 'step', stepId: firstStepId }
        : {
            kind: 'review',
          },
    );
  };

  const goToLocation = (nextLocation: PredictionSequenceLocation) => {
    if (nextLocation.kind !== 'step') {
      setIsEditingFromReview(false);
    }

    setLocation(nextLocation);
  };

  const goToStep = (stepId: PredictionStepId) => {
    setIsEditingFromReview((current) => current || location.kind === 'review');
    setLocation({ kind: 'step', stepId });
  };

  const updateChoice = (field: ChoiceFieldName, value: string) => {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      return field === 'firstTry'
        ? enforceFirstTryConsistency(next).form
        : next;
    });
  };

  const updateCustomAnswer = (questionId: string, value: string) => {
    setForm((current) => ({
      ...current,
      customAnswers: {
        ...current.customAnswers,
        [questionId]: value,
      },
    }));
  };

  const updateTeamField = (
    side: TeamSide,
    field: keyof TeamPredictionForm,
    value: string,
  ) => {
    setForm((current) => {
      const result = setTeamPredictionField(current, side, field, value);

      setConversionAdjustmentNotice(
        result.conversionsAdjusted
          ? 'Conversions adjusted to match your predicted tries.'
          : null,
      );

      return result.form;
    });
  };

  const shouldShowConsistencyWarning =
    consistencyIssue !== null &&
    (location.kind === 'review' ||
      (location.kind === 'step' &&
        isScoreKnownAtStep(activeSteps, location.stepId)));

  const submitPrediction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isReadOnly || location.kind !== 'review') {
      return;
    }

    if (consistencyIssue) {
      setFeedback({
        kind: 'error',
        message:
          "Your scores don't match your chosen winner. Adjust the result or scoring predictions before submitting.",
      });
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
      setLocation({ kind: 'review' });
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
      <FixtureHeader
        fixture={fixture}
        isLockedByKickoff={isLockedByKickoff || isReadOnly}
      />

      <PredictionFeedback
        editSession={editSession}
        feedback={feedback}
        onReload={reloadFromSavedEntry}
        savedEntryChanged={Boolean(savedEntryChanged)}
      />

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
          {location.kind === 'intro' ? (
            <PredictionIntro onStart={goToFirstStep} />
          ) : null}

          {location.kind === 'step' ? (
            <PredictionStepView
              activeSteps={activeSteps}
              consistencyIssue={
                shouldShowConsistencyWarning ? consistencyIssue : null
              }
              conversionAdjustmentNotice={conversionAdjustmentNotice}
              fixture={fixture}
              form={form}
              messageSelection={messageSelection}
              onChoiceChange={updateChoice}
              onCustomAnswerChange={updateCustomAnswer}
              onEditStep={goToStep}
              onLocationChange={goToLocation}
              onReturnToReview={() => {
                setIsEditingFromReview(false);
                setLocation({ kind: 'review' });
              }}
              onTeamFieldChange={updateTeamField}
              returnToReviewAvailable={isEditingFromReview}
              ruleset={ruleset}
              stepId={location.stepId}
            />
          ) : null}

          {location.kind === 'review' ? (
            <PredictionReviewScreen
              activeSteps={activeSteps}
              consistencyIssue={consistencyIssue}
              editSession={editSession}
              fixture={fixture}
              form={form}
              isSubmitting={isSubmitting}
              onEditStep={goToStep}
              onLocationChange={goToLocation}
              onReload={reloadFromSavedEntry}
              ruleset={ruleset}
            />
          ) : null}
        </form>
      )}
    </PredictionShell>
  );
};

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

const PredictionFeedback = ({
  editSession,
  feedback,
  onReload,
  savedEntryChanged,
}: {
  readonly editSession: PredictionEditSession;
  readonly feedback: {
    readonly code?: string;
    readonly kind: 'error' | 'success';
    readonly message: string;
  } | null;
  readonly onReload: () => void;
  readonly savedEntryChanged: boolean;
}) => (
  <>
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
              onClick={onReload}
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
            onClick={onReload}
          >
            Reload saved entry
          </button>
        </div>
      </div>
    ) : null}
  </>
);

const PredictionIntro = ({ onStart }: { readonly onStart: () => void }) => (
  <section className="rounded-md border border-rooster-line bg-white p-6 sm:p-8">
    <p className="text-sm font-black uppercase text-rooster-red">
      Standard prediction
    </p>
    <h2 className="mt-4 text-3xl font-black text-rooster-ink sm:text-4xl">
      {predictionIntroMessage.heading}
    </h2>
    <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-rooster-ink">
      {predictionIntroMessage.body}
    </p>
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      <div className="rounded-md border border-rooster-line bg-rooster-paper p-4">
        <h3 className="text-sm font-black uppercase text-rooster-muted">
          Rugby Rooster competition points
        </h3>
        <p className="mt-2 text-sm leading-6 text-rooster-muted">
          Start at{' '}
          {predictionIntroMessage.startingPoints.toLocaleString('en-US')};
          prediction errors cause deductions.
        </p>
      </div>
      <div className="rounded-md border border-rooster-line bg-rooster-paper p-4">
        <h3 className="text-sm font-black uppercase text-rooster-muted">
          Predicted rugby match scores
        </h3>
        <p className="mt-2 text-sm leading-6 text-rooster-muted">
          Derived from your tries, conversions, successful penalty kicks and
          drop goals.
        </p>
      </div>
    </div>
    <button
      className="focus-ring mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-rooster-red px-5 text-base font-black text-white transition hover:bg-rooster-ink sm:w-auto"
      type="button"
      onClick={onStart}
    >
      {predictionIntroMessage.actionLabel}
    </button>
  </section>
);

const PredictionStepView = ({
  activeSteps,
  consistencyIssue,
  conversionAdjustmentNotice,
  fixture,
  form,
  messageSelection,
  onChoiceChange,
  onCustomAnswerChange,
  onEditStep,
  onLocationChange,
  onReturnToReview,
  onTeamFieldChange,
  returnToReviewAvailable,
  ruleset,
  stepId,
}: {
  readonly activeSteps: readonly PredictionSequenceStepDefinition[];
  readonly consistencyIssue: ReturnType<typeof resultConsistencyIssue>;
  readonly conversionAdjustmentNotice: string | null;
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly messageSelection: PredictionMessageVariantSelection;
  readonly onChoiceChange: PredictionStepContentProps['onChoiceChange'];
  readonly onCustomAnswerChange: PredictionStepContentProps['onCustomAnswerChange'];
  readonly onEditStep: (stepId: PredictionStepId) => void;
  readonly onLocationChange: (location: PredictionSequenceLocation) => void;
  readonly onReturnToReview: () => void;
  readonly onTeamFieldChange: PredictionStepContentProps['onTeamFieldChange'];
  readonly returnToReviewAvailable: boolean;
  readonly ruleset: RulesetSnapshot;
  readonly stepId: PredictionStepId;
}) => {
  const step = activeSteps.find((candidate) => candidate.id === stepId);
  const position = predictionStepPosition(activeSteps, stepId);

  if (!step || !position) {
    return null;
  }

  const customQuestion = isCustomPredictionStep(step)
    ? customQuestionById(ruleset, step.questionId)
    : null;

  if (isCustomPredictionStep(step) && !customQuestion) {
    return null;
  }

  const message = isBuiltInPredictionStep(step)
    ? resolvePredictionStepMessage(step.messageId, messageSelection, {
        ruleset,
        team1Name: fixture.team1DisplayName,
        team2Name: fixture.team2DisplayName,
      })
    : {
        body: customQuestion?.banter ?? null,
        deduction:
          customQuestion?.type === 'custom-numeric'
            ? customNumberDeductionText(customQuestion)
            : customQuestion
              ? customChoiceDeductionText(customQuestion)
              : null,
        heading: customQuestion?.prompt ?? '',
        supportingText: [],
      };
  const customValidationMessage = customQuestion
    ? customStepValidationMessage(
        customQuestion,
        form.customAnswers[customQuestion.id] ?? '',
      )
    : null;
  const BuiltInStepContent = isBuiltInPredictionStep(step)
    ? builtInStepRenderers[step.id]
    : null;
  const forwardNavigationDisabled =
    consistencyIssue !== null || customValidationMessage !== null;

  return (
    <section className="rounded-md border border-rooster-line bg-white p-5 sm:p-6">
      <PredictionProgress current={position.current} total={position.total} />
      <div className="mt-5">
        <p className="text-sm font-black uppercase text-rooster-red">
          Step {position.current} of {position.total}
        </p>
        <h2 className="mt-2 text-2xl font-black text-rooster-ink sm:text-3xl">
          {message.heading}
        </h2>
        {message.body ? (
          <p className="mt-2 max-w-3xl text-base font-semibold leading-7 text-rooster-ink">
            {message.body}
          </p>
        ) : null}
        {message.deduction ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-rooster-muted">
            {message.deduction}
          </p>
        ) : null}
        {message.supportingText.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {message.supportingText.map((text) => (
              <p
                className="text-sm font-semibold leading-6 text-rooster-muted"
                key={text}
              >
                {text}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        {BuiltInStepContent ? (
          <BuiltInStepContent
            conversionAdjustmentNotice={conversionAdjustmentNotice}
            fixture={fixture}
            form={form}
            onChoiceChange={onChoiceChange}
            onCustomAnswerChange={onCustomAnswerChange}
            onEditStep={onEditStep}
            onTeamFieldChange={onTeamFieldChange}
            ruleset={ruleset}
          />
        ) : customQuestion ? (
          <CustomQuestionStep
            form={form}
            question={customQuestion}
            onCustomAnswerChange={onCustomAnswerChange}
          />
        ) : null}
      </div>

      {consistencyIssue ? (
        <div className="mt-5">
          <ResultConsistencyWarning
            activeSteps={activeSteps}
            issue={consistencyIssue}
            onEditStep={onEditStep}
          />
        </div>
      ) : null}

      {customValidationMessage ? (
        <p
          className="mt-5 rounded-md border border-rooster-sun/50 bg-rooster-sun/10 p-3 text-sm font-bold text-rooster-ink"
          role="alert"
        >
          {customValidationMessage}
        </p>
      ) : null}

      <StepNavigation
        backLocation={previousPredictionLocation(activeSteps, step.id)}
        continueLabel={
          isFinalPredictionStep(activeSteps, step.id)
            ? 'Review predictions'
            : 'Continue'
        }
        forwardNavigationDisabled={forwardNavigationDisabled}
        nextLocation={nextPredictionLocation(activeSteps, step.id)}
        onLocationChange={onLocationChange}
        onReturnToReview={onReturnToReview}
        returnToReviewAvailable={returnToReviewAvailable}
      />
    </section>
  );
};

const PredictionProgress = ({
  current,
  total,
}: {
  readonly current: number;
  readonly total: number;
}) => (
  <div aria-label={`Step ${current} of ${total}`} role="group">
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span
          className={[
            'h-2 flex-1 rounded-full',
            index < current ? 'bg-rooster-red' : 'bg-rooster-line',
          ].join(' ')}
          key={index}
        />
      ))}
    </div>
  </div>
);

const StepNavigation = ({
  backLocation,
  continueLabel,
  forwardNavigationDisabled,
  nextLocation,
  onLocationChange,
  onReturnToReview,
  returnToReviewAvailable,
}: {
  readonly backLocation: PredictionSequenceLocation;
  readonly continueLabel: string;
  readonly forwardNavigationDisabled: boolean;
  readonly nextLocation: PredictionSequenceLocation;
  readonly onLocationChange: (location: PredictionSequenceLocation) => void;
  readonly onReturnToReview: () => void;
  readonly returnToReviewAvailable: boolean;
}) => (
  <div className="mt-7 flex flex-col-reverse gap-3 border-t border-rooster-line pt-5 sm:flex-row sm:items-center sm:justify-between">
    <button
      className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md border border-rooster-line bg-white px-5 text-base font-black text-rooster-ink transition hover:bg-rooster-paper sm:w-auto"
      type="button"
      onClick={() => onLocationChange(backLocation)}
    >
      Back
    </button>
    <div className="flex flex-col gap-3 sm:flex-row">
      {returnToReviewAvailable ? (
        <button
          className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md border border-rooster-line bg-white px-5 text-base font-black text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:text-rooster-muted sm:w-auto"
          disabled={forwardNavigationDisabled}
          type="button"
          onClick={onReturnToReview}
        >
          Return to Review
        </button>
      ) : null}
      <button
        className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md bg-rooster-red px-5 text-base font-black text-white transition hover:bg-rooster-ink disabled:cursor-not-allowed disabled:bg-rooster-muted sm:w-auto"
        disabled={forwardNavigationDisabled}
        type="button"
        onClick={() => onLocationChange(nextLocation)}
      >
        {continueLabel}
      </button>
    </div>
  </div>
);

const builtInStepRenderers: Record<
  Exclude<PredictionStepId, `custom:${string}`>,
  PredictionStepRenderer
> = {
  cards: (props) => <CardsStep {...props} />,
  conversions: (props) => (
    <ScoreComponentStep component="conversions" {...props} />
  ),
  'drop-goals': (props) => (
    <ScoreComponentStep component="dropGoals" {...props} />
  ),
  'first-try': (props) => <FirstTryStep {...props} />,
  'half-time-leader': (props) => <HalfTimeLeaderStep {...props} />,
  'highest-scoring-half': (props) => <HighestScoringHalfStep {...props} />,
  'match-result': (props) => <MatchResultStep {...props} />,
  'penalty-kicks': (props) => (
    <ScoreComponentStep component="penaltyKicks" {...props} />
  ),
  tries: (props) => <ScoreComponentStep component="tries" {...props} />,
};

const MatchResultStep = ({
  fixture,
  form,
  onChoiceChange,
}: PredictionStepContentProps) => (
  <PredictionChoiceGroup
    label="Who do you think will win?"
    name="match-result"
    onChange={(value) => onChoiceChange('matchResult', value)}
    options={[
      { label: teamDisplayName(fixture, 'team1'), value: 'team1' },
      { label: teamDisplayName(fixture, 'team2'), value: 'team2' },
      { label: 'Draw', value: 'draw' },
    ]}
    selectedLabel={matchResultLabel(fixture, form.matchResult)}
    value={form.matchResult}
  />
);

type ScoreComponent = 'conversions' | 'dropGoals' | 'penaltyKicks' | 'tries';

const scoreComponentCopy = {
  conversions: {
    label: 'Conversions',
    pointsText: `${teamScoreComponentRugbyPoints.conversions} rugby points each`,
  },
  dropGoals: {
    label: 'Drop goals',
    pointsText: `${teamScoreComponentRugbyPoints.dropGoals} rugby points each`,
  },
  penaltyKicks: {
    label: 'Successful penalty kicks',
    pointsText: `${teamScoreComponentRugbyPoints.penaltyKicks} rugby points each`,
  },
  tries: {
    label: 'Tries',
    pointsText: `Points from tries: ${teamScoreComponentRugbyPoints.tries} rugby points each`,
  },
} as const satisfies Record<
  ScoreComponent,
  { readonly label: string; readonly pointsText: string }
>;

const ScoreComponentStep = ({
  component,
  conversionAdjustmentNotice,
  fixture,
  form,
  onTeamFieldChange,
}: PredictionStepContentProps & {
  readonly component: ScoreComponent;
}) => (
  <div className="grid gap-4">
    {conversionAdjustmentNotice ? (
      <p
        className="rounded-md border border-rooster-sun/50 bg-rooster-sun/10 p-3 text-sm font-semibold text-rooster-ink"
        role="status"
      >
        {conversionAdjustmentNotice}
      </p>
    ) : null}
    <TeamPredictionGrid>
      {(['team1', 'team2'] as const).map((side) => (
        <ScoreComponentTeamPanel
          component={component}
          fixture={fixture}
          form={form[side]}
          key={side}
          onChange={(value) => onTeamFieldChange(side, component, value)}
          side={side}
        />
      ))}
    </TeamPredictionGrid>
  </div>
);

const ScoreComponentTeamPanel = ({
  component,
  fixture,
  form,
  onChange,
  side,
}: {
  readonly component: ScoreComponent;
  readonly fixture: FixtureDocument;
  readonly form: TeamPredictionForm;
  readonly onChange: (value: string) => void;
  readonly side: TeamSide;
}) => {
  const teamName = teamDisplayName(fixture, side);
  const score = deriveTeamScoreFromForm(form, fixture, side);
  const tries = parseFormWholeNumber(form.tries);
  const conversions = parseFormWholeNumber(form.conversions);
  const isConversionStep = component === 'conversions';
  const conversionMaximum = maxAttributeForWholeNumber(form.tries);
  const conversionsDisabled = isConversionStep && tries === 0;
  const supportingText =
    isConversionStep && tries !== null
      ? tries === 0
        ? 'No tries to convert'
        : `${conversions ?? 0} of ${tries} tries converted.`
      : scoreComponentCopy[component].pointsText;

  return (
    <TeamPredictionPanel
      score={score.score}
      scoreMessage={score.message}
      teamName={teamName}
    >
      <NumericPredictionControl
        disabled={conversionsDisabled}
        inputLabel={`${teamName} ${inputLabelForComponent(component)}`}
        label={scoreComponentCopy[component].label}
        max={isConversionStep ? conversionMaximum : undefined}
        onChange={onChange}
        supportingText={supportingText}
        value={form[component]}
      />
    </TeamPredictionPanel>
  );
};

const inputLabelForComponent = (component: ScoreComponent): string => {
  if (component === 'penaltyKicks') {
    return 'penalty kicks';
  }

  if (component === 'dropGoals') {
    return 'drop goals';
  }

  return component;
};

const CardsStep = ({
  fixture,
  form,
  onTeamFieldChange,
  ruleset,
}: PredictionStepContentProps) => (
  <TeamPredictionGrid>
    {(['team1', 'team2'] as const).map((side) => {
      const teamName = teamDisplayName(fixture, side);
      const score = deriveTeamScoreFromForm(form[side], fixture, side);

      return (
        <TeamPredictionPanel
          key={side}
          score={score.score}
          scoreMessage={score.message}
          teamName={teamName}
        >
          <div className="grid gap-3">
            {isBuiltInEnabled(ruleset, 'yellow-cards') ? (
              <NumericPredictionControl
                inputLabel={`${teamName} yellow cards`}
                label="Yellow cards"
                onChange={(value) =>
                  onTeamFieldChange(side, 'yellowCards', value)
                }
                supportingText="Cards do not alter the predicted rugby score."
                value={form[side].yellowCards}
              />
            ) : null}
            {isBuiltInEnabled(ruleset, 'red-cards') ? (
              <NumericPredictionControl
                inputLabel={`${teamName} red cards`}
                label="Red cards"
                onChange={(value) => onTeamFieldChange(side, 'redCards', value)}
                supportingText="Cards do not alter the predicted rugby score."
                value={form[side].redCards}
              />
            ) : null}
          </div>
        </TeamPredictionPanel>
      );
    })}
  </TeamPredictionGrid>
);

const FirstTryStep = ({
  fixture,
  form,
  onChoiceChange,
  onEditStep,
}: PredictionStepContentProps) => {
  const constraint = firstTryConstraintForForm(form);
  const options: readonly {
    readonly disabled?: boolean;
    readonly label: string;
    readonly value: FirstTryAnswer;
  }[] = (
    [
      { label: teamDisplayName(fixture, 'team1'), value: 'team1' },
      { label: teamDisplayName(fixture, 'team2'), value: 'team2' },
      { label: 'No Tries Today!', value: 'no-tries' },
    ] as const
  ).map((option) => ({
    ...option,
    disabled: !constraint.allowedAnswers.includes(option.value),
  }));

  return (
    <div className="grid gap-4">
      <PredictionChoiceGroup
        label="Who will score the first try?"
        name="first-try"
        onChange={(value) => onChoiceChange('firstTry', value)}
        options={options}
        selectedLabel={firstTryLabel(fixture, form.firstTry)}
        value={form.firstTry}
      />
      {constraint.message ? (
        <div className="rounded-md border border-rooster-line bg-rooster-paper p-3 text-sm font-semibold text-rooster-muted">
          {constraint.message}
          <button
            className="focus-ring ml-2 min-h-9 rounded-md border border-rooster-line bg-white px-3 text-xs font-black text-rooster-ink transition hover:bg-rooster-paper"
            type="button"
            onClick={() => onEditStep('tries')}
          >
            Edit tries
          </button>
        </div>
      ) : null}
    </div>
  );
};

const HighestScoringHalfStep = ({
  form,
  onChoiceChange,
}: PredictionStepContentProps) => (
  <PredictionChoiceGroup
    label="Which half do you think will produce the most points?"
    name="highest-scoring-half"
    onChange={(value) => onChoiceChange('highestScoringHalf', value)}
    options={[
      { label: 'First Half', value: 'first' },
      { label: 'Second Half', value: 'second' },
      { label: 'Equal Points', value: 'equal' },
    ]}
    selectedLabel={highestHalfLabel(form.highestScoringHalf)}
    value={form.highestScoringHalf}
  />
);

const HalfTimeLeaderStep = ({
  fixture,
  form,
  onChoiceChange,
}: PredictionStepContentProps) => (
  <PredictionChoiceGroup
    label="Who will lead at half-time?"
    name="half-time-leader"
    onChange={(value) => onChoiceChange('halfTimeLeader', value)}
    options={[
      { label: teamDisplayName(fixture, 'team1'), value: 'team1' },
      { label: teamDisplayName(fixture, 'team2'), value: 'team2' },
      { label: 'Half-time Draw', value: 'draw' },
    ]}
    selectedLabel={halfTimeLeaderLabel(fixture, form.halfTimeLeader)}
    value={form.halfTimeLeader}
  />
);

const CustomQuestionStep = ({
  form,
  onCustomAnswerChange,
  question,
}: {
  readonly form: PredictionFormState;
  readonly onCustomAnswerChange: (questionId: string, value: string) => void;
  readonly question: ActiveCustomQuestion;
}) => {
  const value = form.customAnswers[question.id] ?? '';

  if (question.type === 'custom-numeric') {
    const normalizeOnBlur = () => {
      const parsed = parseFormWholeNumber(value);

      if (parsed === null) {
        return;
      }

      onCustomAnswerChange(
        question.id,
        String(Math.min(question.max, Math.max(question.min, parsed))),
      );
    };

    return (
      <div className="grid gap-4">
        <CustomQuestionExplanation question={question} />
        <div className="max-w-sm">
          <NumericPredictionControl
            inputLabel={`${question.prompt} answer`}
            label="Your prediction"
            max={String(question.max)}
            min={String(question.min)}
            onBlur={normalizeOnBlur}
            onChange={(nextValue) =>
              onCustomAnswerChange(question.id, nextValue)
            }
            supportingText={`Range: ${question.min} to ${question.max}`}
            value={value}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <CustomQuestionExplanation question={question} />
      <PredictionChoiceGroup
        label={question.prompt}
        name={`custom-${question.id}`}
        onChange={(nextValue) => onCustomAnswerChange(question.id, nextValue)}
        options={question.options.map((option) => ({
          label: option.label,
          value: option.id,
        }))}
        selectedLabel={customAnswerDisplayValue(question, value)}
        value={value}
      />
    </div>
  );
};

const CustomQuestionExplanation = ({
  question,
}: {
  readonly question: ActiveCustomQuestion;
}) => (
  <div className="grid gap-3">
    <section className="rounded-md border border-rooster-line bg-rooster-paper p-4">
      <h3 className="text-xs font-black uppercase text-rooster-muted">
        What counts
      </h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-rooster-ink">
        {question.countingDefinition}
      </p>
    </section>
  </div>
);

const TeamPredictionGrid = ({ children }: { readonly children: ReactNode }) => (
  <div className="grid gap-4 md:grid-cols-2">{children}</div>
);

const TeamPredictionPanel = ({
  children,
  score,
  scoreMessage,
  teamName,
}: {
  readonly children: ReactNode;
  readonly score: number | null;
  readonly scoreMessage: string | null;
  readonly teamName: string;
}) => (
  <section className="rounded-md border border-rooster-line bg-rooster-paper p-4">
    <p className="text-xs font-black uppercase text-rooster-muted">
      Predicted rugby score
    </p>
    <p className="mt-1 text-4xl font-black text-rooster-ink">
      {score === null ? '-' : score}
    </p>
    <h3 className="mt-1 text-lg font-black text-rooster-ink">{teamName}</h3>
    {scoreMessage ? (
      <p className="mt-2 text-xs font-semibold leading-5 text-rooster-muted">
        {scoreMessage}
      </p>
    ) : null}
    <div className="mt-4">{children}</div>
  </section>
);

const NumericPredictionControl = ({
  disabled = false,
  inputLabel,
  label,
  max,
  min = '0',
  onBlur,
  onChange,
  supportingText,
  value,
}: {
  readonly disabled?: boolean;
  readonly inputLabel: string;
  readonly label: string;
  readonly max?: string;
  readonly min?: string;
  readonly onBlur?: () => void;
  readonly onChange: (value: string) => void;
  readonly supportingText?: string;
  readonly value: string;
}) => {
  const id = useId();
  const parsed = parseFormWholeNumber(value);
  const parsedMin = parseFormWholeNumber(min) ?? 0;
  const parsedMax = max === undefined ? null : parseFormWholeNumber(max);
  const canDecrement = !disabled && parsed !== null && parsed > parsedMin;
  const canIncrement =
    !disabled && (parsed === null || parsedMax === null || parsed < parsedMax);

  const increment = () => {
    onChange(String(parsed === null ? parsedMin : parsed + 1));
  };
  const decrement = () => {
    onChange(String(Math.max(parsedMin, (parsed ?? parsedMin) - 1)));
  };

  return (
    <div>
      <label className="block text-sm font-black text-rooster-ink" htmlFor={id}>
        {label}
      </label>
      <div className="mt-2 grid grid-cols-[3rem_minmax(0,1fr)_3rem] overflow-hidden rounded-md border border-rooster-line bg-white">
        <button
          aria-label={`Decrease ${inputLabel}`}
          className="focus-ring min-h-12 border-r border-rooster-line text-xl font-black text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:text-rooster-muted"
          disabled={!canDecrement}
          type="button"
          onClick={decrement}
        >
          -
        </button>
        <input
          className="focus-ring min-h-12 w-full border-0 bg-white px-3 text-center text-lg font-black text-rooster-ink disabled:bg-rooster-paper disabled:text-rooster-muted"
          aria-label={inputLabel}
          disabled={disabled}
          id={id}
          inputMode="numeric"
          max={max}
          min={min}
          onBlur={onBlur}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
          pattern="[0-9]*"
          step="1"
          type="number"
          value={value}
        />
        <button
          aria-label={`Increase ${inputLabel}`}
          className="focus-ring min-h-12 border-l border-rooster-line text-xl font-black text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:text-rooster-muted"
          disabled={!canIncrement}
          type="button"
          onClick={increment}
        >
          +
        </button>
      </div>
      {supportingText ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-rooster-muted">
          {supportingText}
        </p>
      ) : null}
    </div>
  );
};

const PredictionChoiceGroup = ({
  label,
  name,
  onChange,
  options,
  selectedLabel,
  value,
}: {
  readonly label: string;
  readonly name: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly {
    readonly disabled?: boolean;
    readonly label: string;
    readonly value: string;
  }[];
  readonly selectedLabel: string;
  readonly value: string;
}) => (
  <fieldset>
    <legend className="sr-only">{label}</legend>
    <div className="grid gap-3 sm:grid-cols-3">
      {options.map((option) => {
        const checked = option.value === value;

        return (
          <label
            className={[
              'flex min-h-16 cursor-pointer items-center rounded-md border p-4 text-sm font-black transition',
              checked
                ? 'border-rooster-red bg-rooster-red text-white'
                : 'border-rooster-line bg-white text-rooster-ink hover:bg-rooster-paper',
              option.disabled ? 'cursor-not-allowed opacity-60' : '',
            ].join(' ')}
            key={option.value}
          >
            <input
              checked={checked}
              className="focus-ring mr-3 h-4 w-4 accent-rooster-red"
              disabled={option.disabled}
              name={name}
              type="radio"
              value={option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
    {value ? (
      <p className="mt-3 text-sm font-black text-rooster-ink">
        You picked {selectedLabel}
      </p>
    ) : null}
  </fieldset>
);

const ResultConsistencyWarning = ({
  activeSteps,
  issue,
  onEditStep,
}: {
  readonly activeSteps: readonly PredictionSequenceStepDefinition[];
  readonly issue: NonNullable<ReturnType<typeof resultConsistencyIssue>>;
  readonly onEditStep: (stepId: PredictionStepId) => void;
}) => {
  const resultStep = editStepIdForReviewSection(activeSteps, 'match-result');
  const scoreStep = editStepIdForReviewSection(activeSteps, 'predicted-score');

  return (
    <div
      className="rounded-md border border-rooster-red/40 bg-rooster-red/10 p-4"
      role="alert"
    >
      <h3 className="text-sm font-black uppercase text-rooster-red">
        {issue.heading}
      </h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-rooster-ink">
        {issue.body}
      </p>
      <p className="mt-1 text-sm leading-6 text-rooster-muted">
        Go back to adjust your scores or change your chosen winner.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {resultStep ? (
          <button
            className="focus-ring min-h-10 rounded-md border border-rooster-line bg-white px-3 text-sm font-black text-rooster-ink transition hover:bg-rooster-paper"
            type="button"
            onClick={() => onEditStep(resultStep)}
          >
            Edit match result
          </button>
        ) : null}
        {scoreStep ? (
          <button
            className="focus-ring min-h-10 rounded-md border border-rooster-line bg-white px-3 text-sm font-black text-rooster-ink transition hover:bg-rooster-paper"
            type="button"
            onClick={() => onEditStep(scoreStep)}
          >
            Edit scores
          </button>
        ) : null}
      </div>
    </div>
  );
};

const PredictionReviewScreen = ({
  activeSteps,
  consistencyIssue,
  editSession,
  fixture,
  form,
  isSubmitting,
  onEditStep,
  onLocationChange,
  onReload,
  ruleset,
}: {
  readonly activeSteps: readonly PredictionSequenceStepDefinition[];
  readonly consistencyIssue: ReturnType<typeof resultConsistencyIssue>;
  readonly editSession: PredictionEditSession;
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly isSubmitting: boolean;
  readonly onEditStep: (stepId: PredictionStepId) => void;
  readonly onLocationChange: (location: PredictionSequenceLocation) => void;
  readonly onReload: () => void;
  readonly ruleset: RulesetSnapshot;
}) => {
  const finalStep = activeSteps[activeSteps.length - 1];

  return (
    <section className="rounded-md border border-rooster-line bg-white p-5 sm:p-6">
      <p className="text-sm font-black uppercase text-rooster-red">Review</p>
      <h2 className="mt-2 text-2xl font-black text-rooster-ink sm:text-3xl">
        Review predictions
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-rooster-muted">
        This is your predicted rugby match score and prediction detail. Rugby
        Rooster competition points are deductions calculated after the match.
      </p>

      {consistencyIssue ? (
        <div className="mt-5">
          <ResultConsistencyWarning
            activeSteps={activeSteps}
            issue={consistencyIssue}
            onEditStep={onEditStep}
          />
        </div>
      ) : null}

      <div className="mt-5">
        <PredictionReviewSummary
          activeSteps={activeSteps}
          fixture={fixture}
          form={form}
          onEditStep={onEditStep}
          ruleset={ruleset}
        />
      </div>

      <div className="mt-7 rounded-md border border-rooster-line bg-rooster-paper p-4">
        <p className="text-sm leading-6 text-rooster-muted">
          {editSession.expectedRevision === null
            ? 'This will create your prediction for the fixture.'
            : `This revision started from saved entry revision ${editSession.expectedRevision}.`}
        </p>
        {consistencyIssue ? (
          <p className="mt-2 text-sm font-bold text-rooster-red">
            Submission is disabled until your chosen result matches your
            predicted rugby scores.
          </p>
        ) : null}
        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md border border-rooster-line bg-white px-5 text-base font-black text-rooster-ink transition hover:bg-rooster-paper sm:w-auto"
            type="button"
            onClick={() =>
              onLocationChange(
                finalStep
                  ? { kind: 'step', stepId: finalStep.id }
                  : { kind: 'intro' },
              )
            }
          >
            Back
          </button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md border border-rooster-line bg-white px-5 text-base font-black text-rooster-ink transition hover:bg-rooster-paper sm:w-auto"
              disabled={isSubmitting}
              type="button"
              onClick={onReload}
            >
              Reload saved entry
            </button>
            <button
              className="focus-ring inline-flex min-h-12 w-full items-center justify-center rounded-md bg-rooster-red px-5 text-base font-black text-white transition hover:bg-rooster-ink disabled:cursor-not-allowed disabled:bg-rooster-muted sm:w-auto"
              disabled={isSubmitting || Boolean(consistencyIssue)}
              type="submit"
            >
              {isSubmitting
                ? 'Saving prediction'
                : editSession.expectedRevision === null
                  ? 'Submit prediction'
                  : 'Save revised prediction'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

const PredictionReviewSummary = ({
  activeSteps,
  fixture,
  form,
  onEditStep,
  ruleset,
}: {
  readonly activeSteps: readonly PredictionSequenceStepDefinition[];
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly onEditStep?: (stepId: PredictionStepId) => void;
  readonly ruleset: RulesetSnapshot;
}) => {
  const derived = deriveScoresFromForm(form, fixture);
  const isYellowCardsActive = isBuiltInEnabled(ruleset, 'yellow-cards');
  const isRedCardsActive = isBuiltInEnabled(ruleset, 'red-cards');
  const isFirstTryActive = isBuiltInEnabled(ruleset, 'first-try');
  const isHighestScoringHalfActive = isBuiltInEnabled(
    ruleset,
    'highest-scoring-half',
  );
  const isHalfTimeLeaderActive = isBuiltInEnabled(ruleset, 'half-time-leader');
  const hasActiveCardQuestions = isYellowCardsActive || isRedCardsActive;
  const hasActiveOtherPredictions =
    isFirstTryActive || isHighestScoringHalfActive || isHalfTimeLeaderActive;
  const customQuestions = activeCustomQuestions(ruleset);

  return (
    <div className="grid gap-4">
      {isBuiltInEnabled(ruleset, 'match-result') ? (
        <ReviewSection
          editStepId={editStepIdForReviewSection(activeSteps, 'match-result')}
          onEditStep={onEditStep}
          title="MATCH RESULT"
        >
          <ReviewLine
            label="Chosen result"
            value={matchResultLabel(fixture, form.matchResult)}
          />
        </ReviewSection>
      ) : null}

      <ReviewSection
        editStepId={editStepIdForReviewSection(activeSteps, 'predicted-score')}
        onEditStep={onEditStep}
        title="PREDICTED SCORE"
      >
        <ReviewLine
          detail={derived.team1.message}
          label={`${teamDisplayName(fixture, 'team1')} predicted rugby match score`}
          value={
            derived.team1.score === null
              ? 'Unavailable'
              : String(derived.team1.score)
          }
        />
        <ReviewLine
          detail={derived.team2.message}
          label={`${teamDisplayName(fixture, 'team2')} predicted rugby match score`}
          value={
            derived.team2.score === null
              ? 'Unavailable'
              : String(derived.team2.score)
          }
        />
        <ReviewLine
          detail={derived.resultMessage}
          label="Derived result"
          value={
            derived.matchResult
              ? matchResultLabel(fixture, derived.matchResult)
              : 'Unavailable'
          }
        />
      </ReviewSection>

      <ReviewSection
        editStepId={editStepIdForReviewSection(activeSteps, 'scoring-detail')}
        onEditStep={onEditStep}
        title="SCORING DETAIL"
      >
        {(['team1', 'team2'] as const).map((side) => (
          <ReviewTeamScoringDetail
            form={form[side]}
            key={side}
            teamName={teamDisplayName(fixture, side)}
          />
        ))}
      </ReviewSection>

      {hasActiveCardQuestions ? (
        <ReviewSection
          editStepId={editStepIdForReviewSection(activeSteps, 'cards')}
          onEditStep={onEditStep}
          title="CARDS"
        >
          {(['team1', 'team2'] as const).map((side) => (
            <div
              className="rounded-md border border-rooster-line bg-rooster-paper p-3"
              key={side}
            >
              <p className="text-sm font-black text-rooster-ink">
                {teamDisplayName(fixture, side)}
              </p>
              {isYellowCardsActive ? (
                <ReviewLine label="Yellow" value={form[side].yellowCards} />
              ) : null}
              {isRedCardsActive ? (
                <ReviewLine label="Red" value={form[side].redCards} />
              ) : null}
            </div>
          ))}
        </ReviewSection>
      ) : null}

      {hasActiveOtherPredictions ? (
        <ReviewSection title="OTHER PREDICTIONS">
          {isFirstTryActive ? (
            <ReviewEditableLine
              activeSteps={activeSteps}
              label="First try"
              onEditStep={onEditStep}
              reviewSectionId="first-try"
              value={firstTryLabel(fixture, form.firstTry)}
            />
          ) : null}
          {isHighestScoringHalfActive ? (
            <ReviewEditableLine
              activeSteps={activeSteps}
              label="Highest-scoring half"
              onEditStep={onEditStep}
              reviewSectionId="highest-scoring-half"
              value={highestHalfLabel(form.highestScoringHalf)}
            />
          ) : null}
          {isHalfTimeLeaderActive ? (
            <ReviewEditableLine
              activeSteps={activeSteps}
              label="Half-time leader"
              onEditStep={onEditStep}
              reviewSectionId="half-time-leader"
              value={halfTimeLeaderLabel(fixture, form.halfTimeLeader)}
            />
          ) : null}
        </ReviewSection>
      ) : null}

      {customQuestions.length > 0 ? (
        <ReviewSection title="CUSTOM QUESTIONS">
          {customQuestions.map((question) => (
            <ReviewCustomQuestion
              activeSteps={activeSteps}
              form={form}
              key={question.id}
              onEditStep={onEditStep}
              question={question}
            />
          ))}
        </ReviewSection>
      ) : null}
    </div>
  );
};

const ReviewSection = ({
  children,
  editStepId,
  onEditStep,
  title,
}: {
  readonly children: ReactNode;
  readonly editStepId?: PredictionStepId | null;
  readonly onEditStep?: (stepId: PredictionStepId) => void;
  readonly title: string;
}) => (
  <section
    className="rounded-md border border-rooster-line bg-white p-4"
    role="group"
    aria-label={`Review ${title}`}
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-black uppercase text-rooster-muted">
        {title}
      </h3>
      {editStepId && onEditStep ? (
        <button
          className="focus-ring min-h-9 rounded-md border border-rooster-line bg-white px-3 text-xs font-black text-rooster-ink transition hover:bg-rooster-paper"
          type="button"
          onClick={() => onEditStep(editStepId)}
        >
          Edit
        </button>
      ) : null}
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
  </section>
);

const ReviewLine = ({
  detail,
  label,
  value,
}: {
  readonly detail?: string | null;
  readonly label: string;
  readonly value: string;
}) => (
  <div>
    <dt className="text-xs font-black uppercase text-rooster-muted">{label}</dt>
    <dd className="mt-1 text-sm font-black text-rooster-ink">{value}</dd>
    {detail ? (
      <p className="mt-1 text-xs font-semibold leading-5 text-rooster-muted">
        {detail}
      </p>
    ) : null}
  </div>
);

const ReviewEditableLine = ({
  activeSteps,
  label,
  onEditStep,
  reviewSectionId,
  value,
}: {
  readonly activeSteps: readonly PredictionSequenceStepDefinition[];
  readonly label: string;
  readonly onEditStep?: (stepId: PredictionStepId) => void;
  readonly reviewSectionId: PredictionReviewSectionId;
  readonly value: string;
}) => {
  const editStepId = editStepIdForReviewSection(activeSteps, reviewSectionId);

  return (
    <div className="rounded-md border border-rooster-line bg-rooster-paper p-3">
      <ReviewLine label={label} value={value} />
      {editStepId && onEditStep ? (
        <button
          className="focus-ring mt-3 min-h-9 rounded-md border border-rooster-line bg-white px-3 text-xs font-black text-rooster-ink transition hover:bg-rooster-paper"
          type="button"
          onClick={() => onEditStep(editStepId)}
        >
          Edit {label.toLowerCase()}
        </button>
      ) : null}
    </div>
  );
};

const ReviewCustomQuestion = ({
  activeSteps,
  form,
  onEditStep,
  question,
}: {
  readonly activeSteps: readonly PredictionSequenceStepDefinition[];
  readonly form: PredictionFormState;
  readonly onEditStep?: (stepId: PredictionStepId) => void;
  readonly question: ActiveCustomQuestion;
}) => {
  const editStepId = editStepIdForCustomQuestion(activeSteps, question.id);
  const value = form.customAnswers[question.id] ?? '';
  const deduction =
    question.type === 'custom-numeric'
      ? customNumberDeductionText(question)
      : customChoiceDeductionText(question);

  return (
    <div className="rounded-md border border-rooster-line bg-rooster-paper p-3">
      <ReviewLine
        detail={deduction}
        label={question.prompt}
        value={customAnswerDisplayValue(question, value)}
      />
      <p className="mt-2 text-xs font-semibold leading-5 text-rooster-muted">
        What counts: {question.countingDefinition}
      </p>
      {editStepId && onEditStep ? (
        <button
          className="focus-ring mt-3 min-h-9 rounded-md border border-rooster-line bg-white px-3 text-xs font-black text-rooster-ink transition hover:bg-rooster-paper"
          type="button"
          onClick={() => onEditStep(editStepId)}
        >
          Edit custom question
        </button>
      ) : null}
    </div>
  );
};

const ReviewTeamScoringDetail = ({
  form,
  teamName,
}: {
  readonly form: TeamPredictionForm;
  readonly teamName: string;
}) => (
  <div className="rounded-md border border-rooster-line bg-rooster-paper p-3">
    <p className="text-sm font-black text-rooster-ink">{teamName}</p>
    <ReviewLine label="Tries" value={form.tries} />
    <ReviewLine label="Conversions" value={form.conversions} />
    <ReviewLine label="Successful penalty kicks" value={form.penaltyKicks} />
    <ReviewLine label="Drop goals" value={form.dropGoals} />
  </div>
);

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
  const activeSteps = activePredictionSteps(ruleset);
  const savedForm = entry
    ? normalizeInitialPredictionForm(
        formFromPrediction(entry.prediction, ruleset),
        ruleset,
      )
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
            <PredictionReviewSummary
              activeSteps={activeSteps}
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
