import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
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
  activeCustomQuestions,
  activePredictionSteps,
  customChoiceDeductionText,
  customNumberDeductionText,
  editStepIdForCustomQuestion,
  editStepIdForReviewSection,
  predictionIntroMessage,
  type PredictionReviewSectionId,
  type PredictionSequenceStepDefinition,
  type PredictionStepId,
  type PredictionEntryDocument,
  type ResolvedPredictionStepMessage,
  PREDICTION_PUBLICATIONS,
} from '/imports/shared/predictions';
import {
  isBuiltInEnabled,
  type FirstTryAnswer,
  type RulesetSnapshot,
  type TeamSide,
} from '/imports/shared/scoring';
import { useAuthState } from '../auth/useAuthState';
import { SignInRequiredState } from '../components/AuthStates';
import { AppLink } from '../components/AppLink';
import {
  PlayerEmptyState,
  PlayerErrorState,
  PlayerLoadingState,
  PlayerPage,
  PlayerPageHeader,
  RugbyRoosterPersonality,
  StatusBadge,
} from '../components/player';
import {
  fixtureDetailPath,
  fixtureLeaderboardPath,
  fixturePlayerStatusLabel,
  fixturePlayerStatusTone,
  fixtureScoreBreakdownPath,
  kickoffLabel,
} from '../fixtures/fixtureUi';
import {
  customAnswerDisplayValue,
  deriveScoresFromForm,
  emptyFormForRuleset,
  firstTryConstraintForForm,
  firstTryLabel,
  halfTimeLeaderLabel,
  formFromPrediction,
  highestHalfLabel,
  matchResultLabel,
  normalizeInitialPredictionForm,
  parseFormWholeNumber,
  teamDisplayName,
  type ActiveCustomQuestion,
  type PredictionFormState,
  type TeamPredictionForm,
} from '../predictions/standardPredictionState';
import {
  usePredictionSession,
  type PredictionChoiceFieldName,
  type PredictionEditSession,
  type PredictionSessionActions,
  type PredictionSessionRendererState,
} from '../predictions/predictionSession';
import {
  PredictionPresentationHost,
  type PredictionPresentationOptions,
} from '../predictions/PredictionPresentationHost';
import {
  CardsPredictionStep,
  ConversionsPredictionStep,
  DropGoalsPredictionStep,
  FirstTryPredictionStep,
  MatchResultPredictionStep,
  PenaltyKicksPredictionStep,
  TriesPredictionStep,
} from '../predictions/reactPredictionPresentation';

type PredictionStepRenderer = (props: PredictionStepContentProps) => ReactNode;

interface PredictionStepContentProps {
  readonly conversionAdjustmentNotice: string | null;
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly onChoiceChange: (
    field: PredictionChoiceFieldName,
    value: string,
  ) => void;
  readonly onCustomAnswerChange: (questionId: string, value: string) => void;
  readonly onEditStep: (stepId: PredictionStepId) => void;
  readonly onTeamFieldChange: (
    side: TeamSide,
    field: keyof TeamPredictionForm,
    value: string,
  ) => void;
  readonly presentation: PredictionPresentationOptions;
  readonly ruleset: RulesetSnapshot;
  readonly stepMessage: ResolvedPredictionStepMessage;
}

const refreshIntervalMs = 15_000;

const fixtureIdFromLocation = (): string =>
  window.location.pathname.split('/').filter(Boolean)[1] ?? '';

const PredictionShell = ({ children }: { readonly children: ReactNode }) => (
  <PlayerPage maxWidth="narrow">{children}</PlayerPage>
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
        <PlayerErrorState
          body="Reconnect to Rugby Rooster to load this fixture."
          title="Prediction page is unavailable right now"
        />
      </PredictionShell>
    );
  }

  if (!isFixtureReady || auth.isLoading) {
    return (
      <PredictionShell>
        <PlayerLoadingState label="Loading prediction page" />
      </PredictionShell>
    );
  }

  if (!fixture) {
    return (
      <PredictionShell>
        <PlayerEmptyState
          action={
            <AppLink
              className="focus-ring rr-button rr-button-primary"
              to="/games"
            >
              Back to games
            </AppLink>
          }
          body="Draft fixtures and unknown fixture links are not available for prediction entry."
          mood="thinking"
          title="Fixture not found"
        />
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
        <PlayerLoadingState label="Loading saved prediction" />
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
  const session = usePredictionSession({
    currentEntry,
    fixture,
    fixtureId,
    initialExpectedRevision,
    initialForm,
    isReadOnly,
    ruleset,
    userId,
  });
  const renderStandardPrediction = useCallback(
    (presentation: PredictionPresentationOptions) => (
      <StandardPredictionRenderer
        actions={session.actions}
        presentation={presentation}
        state={session.state}
      />
    ),
    [session.actions, session.state],
  );

  return (
    <PredictionShell>
      <FixtureHeader
        fixture={fixture}
        isLockedByKickoff={isLockedByKickoff || isReadOnly}
      />

      <PredictionFeedback
        feedback={session.state.feedback}
        onReload={session.actions.loadLatestSavedPrediction}
        savedEntryChanged={session.state.savedEntryChanged}
      />

      {readOnlyReason ? (
        <ReadOnlyPrediction
          entry={currentEntry}
          fixture={fixture}
          reason={readOnlyReason}
          ruleset={ruleset}
        />
      ) : (
        <PredictionPresentationHost
          renderExperience={renderStandardPrediction}
        />
      )}
    </PredictionShell>
  );
};

const StandardPredictionRenderer = ({
  actions,
  presentation,
  state,
}: {
  readonly actions: PredictionSessionActions;
  readonly presentation: PredictionPresentationOptions;
  readonly state: PredictionSessionRendererState;
}) => (
  <form
    className="grid gap-5"
    onSubmit={(event) => {
      event.preventDefault();
      void actions.submitPrediction();
    }}
  >
    {state.location.kind === 'intro' ? (
      <PredictionIntro onStart={actions.startPrediction} />
    ) : null}

    {state.location.kind === 'step' ? (
      <PredictionStepView
        actions={actions}
        presentation={presentation}
        state={state}
      />
    ) : null}

    {state.location.kind === 'review' ? (
      <PredictionReviewScreen
        activeSteps={state.activeSteps}
        canRequestDiscard={state.navigation.canRequestDiscard}
        canSubmit={state.navigation.canSubmit}
        consistencyIssue={state.consistencyIssue}
        editSession={state.editSession}
        fixture={state.fixture}
        form={state.form}
        isDiscardConfirmOpen={state.isDiscardConfirmOpen}
        isPredictionConflict={state.isPredictionConflict}
        isSubmitting={state.isSubmitting}
        onBack={actions.goBack}
        onCancelDiscard={actions.cancelDiscardChanges}
        onConfirmDiscard={actions.confirmDiscardChanges}
        onEditStep={actions.editStep}
        onRequestDiscard={actions.requestDiscardChanges}
        ruleset={state.ruleset}
      />
    ) : null}
  </form>
);

const FixtureHeader = ({
  fixture,
  isLockedByKickoff,
}: {
  readonly fixture: FixtureDocument;
  readonly isLockedByKickoff: boolean;
}) => (
  <PlayerPageHeader
    actions={
      <>
        <AppLink
          className="focus-ring rr-button rr-button-secondary"
          to={fixtureDetailPath(fixture._id)}
        >
          Back to fixture
        </AppLink>
        <AppLink
          className="focus-ring rr-button rr-button-secondary"
          to={fixtureLeaderboardPath(fixture._id)}
        >
          Leaderboard
        </AppLink>
      </>
    }
    eyebrow={
      <>
        <StatusBadge
          label={
            isLockedByKickoff ? 'Locked' : fixturePlayerStatusLabel(fixture)
          }
          tone={
            isLockedByKickoff ? 'warning' : fixturePlayerStatusTone(fixture)
          }
        />
        <span>{fixture.competitionDisplayName}</span>
      </>
    }
    meta={<span>Kickoff: {kickoffLabel(fixture)}</span>}
    personality={
      <RugbyRoosterPersonality
        message={isLockedByKickoff ? 'Pens down.' : 'Make it brave.'}
        mood={isLockedByKickoff ? 'waiting' : 'confident'}
        size="sm"
      />
    }
    subtitle="Your calls stay editable until scheduled kickoff. After that, the saved prediction becomes read-only."
    title={
      <>
        {fixture.team1DisplayName} <span className="rr-versus">vs</span>{' '}
        {fixture.team2DisplayName}
      </>
    }
  />
);

const PredictionFeedback = ({
  feedback,
  onReload,
  savedEntryChanged,
}: {
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
              Your unsaved changes are still on screen. Load the latest saved
              prediction to replace them.
            </p>
            <button
              className="focus-ring rr-button rr-button-secondary mt-3"
              type="button"
              onClick={onReload}
            >
              Load latest saved prediction
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
        Your saved prediction changed in another session. Your unsaved values
        are still on screen.
        <div className="mt-3">
          <button
            className="focus-ring rr-button rr-button-secondary"
            type="button"
            onClick={onReload}
          >
            Load latest saved prediction
          </button>
        </div>
      </div>
    ) : null}
  </>
);

const PredictionIntro = ({ onStart }: { readonly onStart: () => void }) => (
  <section className="rr-surface rr-surface--raised">
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <p className="rr-section-eyebrow">Make your prediction</p>
        <h2 className="rr-section-title mt-3">
          {predictionIntroMessage.heading}
        </h2>
        <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-rr-text">
          {predictionIntroMessage.body}
        </p>
      </div>
      <RugbyRoosterPersonality
        message="Ten thousand to start. Try not to donate them all."
        mood="confident"
        size="sm"
      />
    </div>
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      <div className="rr-mini-stat">
        <h3 className="text-sm font-black uppercase text-rooster-muted">
          Rugby Rooster competition points
        </h3>
        <p className="mt-2 text-sm leading-6 text-rooster-muted">
          Start at{' '}
          {predictionIntroMessage.startingPoints.toLocaleString('en-US')};
          prediction errors cause deductions.
        </p>
      </div>
      <div className="rr-mini-stat">
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
      className="focus-ring rr-button rr-button-primary mt-6 w-full sm:w-auto"
      type="button"
      onClick={onStart}
    >
      {predictionIntroMessage.actionLabel}
    </button>
  </section>
);

const PredictionStepView = ({
  actions,
  presentation,
  state,
}: {
  readonly actions: PredictionSessionActions;
  readonly presentation: PredictionPresentationOptions;
  readonly state: PredictionSessionRendererState;
}) => {
  const currentStep = state.currentStep;

  if (!currentStep) {
    return null;
  }

  const BuiltInStepContent = currentStep.customQuestion
    ? null
    : builtInStepRenderers[
        currentStep.step.id as keyof typeof builtInStepRenderers
      ];
  const consistencyIssue = state.visibleConsistencyIssue;
  const customQuestion = currentStep.customQuestion;
  const customValidationMessage = currentStep.validationMessage;
  const forwardNavigationDisabled = !state.navigation.canContinue;
  const message = currentStep.message;
  const position = currentStep.position;
  const embedsStepMessage =
    !customQuestion &&
    (isReactNumericScoringStep(currentStep.step.id) ||
      currentStep.step.id === 'cards');

  if (!BuiltInStepContent && !customQuestion) {
    return null;
  }

  return (
    <section className="rr-surface rr-surface--raised">
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
        {message.deduction && !embedsStepMessage ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-rooster-muted">
            {message.deduction}
          </p>
        ) : null}
        {message.supportingText.length > 0 && !embedsStepMessage ? (
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
            conversionAdjustmentNotice={state.conversionAdjustmentNotice}
            fixture={state.fixture}
            form={state.form}
            onChoiceChange={actions.selectBuiltInChoice}
            onCustomAnswerChange={actions.changeCustomAnswer}
            onEditStep={actions.editStep}
            onTeamFieldChange={actions.changeTeamNumericField}
            presentation={presentation}
            ruleset={state.ruleset}
            stepMessage={message}
          />
        ) : customQuestion ? (
          <CustomQuestionStep
            form={state.form}
            question={customQuestion}
            onCustomAnswerChange={actions.changeCustomAnswer}
          />
        ) : null}
      </div>

      {consistencyIssue ? (
        <div className="mt-5">
          <ResultConsistencyWarning
            activeSteps={state.activeSteps}
            issue={consistencyIssue}
            onEditStep={actions.editStep}
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
        continueLabel={state.navigation.continueLabel}
        forwardNavigationDisabled={forwardNavigationDisabled}
        onBack={actions.goBack}
        onContinue={actions.continueForward}
        onReturnToReview={actions.returnToReview}
        returnToReviewDisabled={!state.navigation.canReturnToReview}
        returnToReviewAvailable={
          state.location.kind === 'step' && state.isEditingFromReview
        }
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
            index < current ? 'bg-rr-brand' : 'bg-rooster-line',
          ].join(' ')}
          key={index}
        />
      ))}
    </div>
  </div>
);

const StepNavigation = ({
  continueLabel,
  forwardNavigationDisabled,
  onBack,
  onContinue,
  onReturnToReview,
  returnToReviewDisabled,
  returnToReviewAvailable,
}: {
  readonly continueLabel: string;
  readonly forwardNavigationDisabled: boolean;
  readonly onBack: () => void;
  readonly onContinue: () => void;
  readonly onReturnToReview: () => void;
  readonly returnToReviewDisabled: boolean;
  readonly returnToReviewAvailable: boolean;
}) => (
  <div className="mt-7 flex flex-col-reverse gap-3 border-t border-rooster-line pt-5 sm:flex-row sm:items-center sm:justify-between">
    <button
      className="focus-ring rr-button rr-button-secondary w-full sm:w-auto"
      type="button"
      onClick={onBack}
    >
      Back
    </button>
    <div className="flex flex-col gap-3 sm:flex-row">
      {returnToReviewAvailable ? (
        <button
          className="focus-ring rr-button rr-button-secondary w-full sm:w-auto"
          disabled={returnToReviewDisabled}
          type="button"
          onClick={onReturnToReview}
        >
          Return to Review
        </button>
      ) : null}
      <button
        className="focus-ring rr-button rr-button-primary w-full sm:w-auto"
        disabled={forwardNavigationDisabled}
        type="button"
        onClick={onContinue}
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
  conversions: (props) => <ConversionsStep {...props} />,
  'drop-goals': (props) => <DropGoalsStep {...props} />,
  'first-try': (props) => <FirstTryStep {...props} />,
  'half-time-leader': (props) => <HalfTimeLeaderStep {...props} />,
  'highest-scoring-half': (props) => <HighestScoringHalfStep {...props} />,
  'match-result': (props) => <MatchResultStep {...props} />,
  'penalty-kicks': (props) => <PenaltyKicksStep {...props} />,
  tries: (props) => <TriesStep {...props} />,
};

const isReactNumericScoringStep = (
  stepId: PredictionStepId,
): stepId is 'conversions' | 'drop-goals' | 'penalty-kicks' | 'tries' =>
  stepId === 'tries' ||
  stepId === 'conversions' ||
  stepId === 'penalty-kicks' ||
  stepId === 'drop-goals';

const MatchResultStep = ({
  fixture,
  form,
  onChoiceChange,
  presentation,
}: PredictionStepContentProps) => (
  <MatchResultPredictionStep
    fixture={fixture}
    motionEnabled={presentation.animationsEnabled}
    value={form.matchResult}
    onChange={(value) => onChoiceChange('matchResult', value)}
  />
);

const TriesStep = ({
  conversionAdjustmentNotice,
  fixture,
  form,
  onTeamFieldChange,
  presentation,
  stepMessage,
}: PredictionStepContentProps) => (
  <TriesPredictionStep
    conversionAdjustmentNotice={conversionAdjustmentNotice}
    deductionText={stepMessage.deduction}
    fixture={fixture}
    form={form}
    motionEnabled={presentation.animationsEnabled}
    supportingText={stepMessage.supportingText}
    onChange={(side, value) => onTeamFieldChange(side, 'tries', value)}
  />
);

const ConversionsStep = ({
  conversionAdjustmentNotice,
  fixture,
  form,
  onTeamFieldChange,
  presentation,
  stepMessage,
}: PredictionStepContentProps) => (
  <ConversionsPredictionStep
    conversionAdjustmentNotice={conversionAdjustmentNotice}
    deductionText={stepMessage.deduction}
    fixture={fixture}
    form={form}
    motionEnabled={presentation.animationsEnabled}
    supportingText={stepMessage.supportingText}
    onChange={(side, value) => onTeamFieldChange(side, 'conversions', value)}
  />
);

const PenaltyKicksStep = ({
  conversionAdjustmentNotice,
  fixture,
  form,
  onTeamFieldChange,
  presentation,
  stepMessage,
}: PredictionStepContentProps) => (
  <PenaltyKicksPredictionStep
    conversionAdjustmentNotice={conversionAdjustmentNotice}
    deductionText={stepMessage.deduction}
    fixture={fixture}
    form={form}
    motionEnabled={presentation.animationsEnabled}
    supportingText={stepMessage.supportingText}
    onChange={(side, value) => onTeamFieldChange(side, 'penaltyKicks', value)}
  />
);

const DropGoalsStep = ({
  conversionAdjustmentNotice,
  fixture,
  form,
  onTeamFieldChange,
  presentation,
  stepMessage,
}: PredictionStepContentProps) => (
  <DropGoalsPredictionStep
    conversionAdjustmentNotice={conversionAdjustmentNotice}
    deductionText={stepMessage.deduction}
    fixture={fixture}
    form={form}
    motionEnabled={presentation.animationsEnabled}
    supportingText={stepMessage.supportingText}
    onChange={(side, value) => onTeamFieldChange(side, 'dropGoals', value)}
  />
);

const CardsStep = ({
  fixture,
  form,
  onTeamFieldChange,
  presentation,
  ruleset,
  stepMessage,
}: PredictionStepContentProps) => (
  <CardsPredictionStep
    deductionText={stepMessage.deduction}
    fixture={fixture}
    form={form}
    motionEnabled={presentation.animationsEnabled}
    showRedCards={isBuiltInEnabled(ruleset, 'red-cards')}
    showYellowCards={isBuiltInEnabled(ruleset, 'yellow-cards')}
    supportingText={stepMessage.supportingText}
    onChange={(side, field, value) => onTeamFieldChange(side, field, value)}
  />
);

const FirstTryStep = ({
  fixture,
  form,
  onChoiceChange,
  onEditStep,
  presentation,
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
    <FirstTryPredictionStep
      constraintMessage={constraint.message}
      fixture={fixture}
      motionEnabled={presentation.animationsEnabled}
      options={options}
      value={form.firstTry}
      onChange={(value) => onChoiceChange('firstTry', value)}
      onEditTries={() => onEditStep('tries')}
    />
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
  readonly issue: NonNullable<
    PredictionSessionRendererState['consistencyIssue']
  >;
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
  canRequestDiscard,
  canSubmit,
  consistencyIssue,
  editSession,
  fixture,
  form,
  isDiscardConfirmOpen,
  isPredictionConflict,
  isSubmitting,
  onBack,
  onCancelDiscard,
  onConfirmDiscard,
  onEditStep,
  onRequestDiscard,
  ruleset,
}: {
  readonly activeSteps: readonly PredictionSequenceStepDefinition[];
  readonly canRequestDiscard: boolean;
  readonly canSubmit: boolean;
  readonly consistencyIssue: PredictionSessionRendererState['consistencyIssue'];
  readonly editSession: PredictionEditSession;
  readonly fixture: FixtureDocument;
  readonly form: PredictionFormState;
  readonly isDiscardConfirmOpen: boolean;
  readonly isPredictionConflict: boolean;
  readonly isSubmitting: boolean;
  readonly onBack: () => void;
  readonly onCancelDiscard: () => void;
  readonly onConfirmDiscard: () => void;
  readonly onEditStep: (stepId: PredictionStepId) => void;
  readonly onRequestDiscard: () => void;
  readonly ruleset: RulesetSnapshot;
}) => {
  const discardHeadingId = useId();
  const discardDescriptionId = useId();
  const discardActionLabel = isPredictionConflict
    ? 'Load latest saved prediction'
    : 'Discard changes';

  return (
    <section className="rr-surface rr-surface--raised">
      <p className="rr-section-eyebrow">Review</p>
      <h2 className="rr-section-title mt-2">Review predictions</h2>
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
            : "You're editing your saved prediction."}
        </p>
        {consistencyIssue ? (
          <p className="mt-2 text-sm font-bold text-rooster-red">
            Submission is disabled until your chosen result matches your
            predicted rugby scores.
          </p>
        ) : null}
        {isDiscardConfirmOpen && !isPredictionConflict ? (
          <div
            aria-describedby={discardDescriptionId}
            aria-labelledby={discardHeadingId}
            className="mt-4 rounded-md border border-rooster-red/30 bg-white p-4"
            role="alertdialog"
          >
            <p
              className="text-sm font-black uppercase text-rooster-red"
              id={discardHeadingId}
            >
              Discard changes?
            </p>
            <p
              className="mt-2 text-sm leading-6 text-rooster-ink"
              id={discardDescriptionId}
            >
              Discard your unsaved changes and restore the last saved
              prediction?
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                className="focus-ring rr-button rr-button-secondary"
                type="button"
                onClick={onCancelDiscard}
              >
                Keep editing
              </button>
              <button
                className="focus-ring rr-button rr-button-danger"
                type="button"
                onClick={onConfirmDiscard}
              >
                Discard changes
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="focus-ring rr-button rr-button-secondary w-full sm:w-auto"
            type="button"
            onClick={onBack}
          >
            Back
          </button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="focus-ring rr-button rr-button-secondary w-full sm:w-auto"
              disabled={!canRequestDiscard}
              type="button"
              onClick={onRequestDiscard}
            >
              {discardActionLabel}
            </button>
            <button
              className="focus-ring rr-button rr-button-primary w-full sm:w-auto"
              disabled={!canSubmit}
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
    <section className="rr-surface rr-surface--raised">
      <h2 className="rr-section-title">Saved prediction</h2>
      <p className="mt-2 text-sm leading-6 text-rooster-muted">{reason}</p>
      {entry && savedForm ? (
        <>
          <p className="mt-2 text-sm font-bold text-rooster-muted">
            Saved revision {entry.revision}.
          </p>
          <AppLink
            className="focus-ring rr-button rr-button-secondary mt-4"
            to={fixtureScoreBreakdownPath(fixture._id)}
          >
            View my score
          </AppLink>
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
