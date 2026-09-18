// @vitest-environment jsdom

import {
  StrictMode,
  act,
  createElement,
  useEffect,
  type ReactElement,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import type { FixtureDocument } from '../../imports/shared/fixtures';
import {
  buildConfiguredRulesetSnapshot,
  defaultFixturePredictionQuestionConfig,
} from '../../imports/shared/predictionQuestions';
import {
  PREDICTION_METHODS,
  type PredictionEntryDocument,
  type PredictionMutationResult,
} from '../../imports/shared/predictions';
import {
  defaultRuleset,
  type FixturePrediction,
  type RulesetSnapshot,
} from '../../imports/shared/scoring';
import {
  emptyFormForRuleset,
  formFromPrediction,
} from '../../imports/ui/predictions/standardPredictionState';
import {
  usePredictionSession,
  type PredictionMethodCaller,
  type PredictionSessionContract,
  type PredictionSessionInput,
} from '../../imports/ui/predictions/predictionSession';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const now = new Date('2026-09-18T08:00:00.000Z');

interface Deferred<TValue> {
  readonly promise: Promise<TValue>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: TValue) => void;
}

interface TransportCall {
  readonly deferred: Deferred<unknown>;
  readonly input: unknown;
  readonly methodName: string;
}

interface SubmitTransportInput {
  readonly expectedRevision?: number;
  readonly fixtureId: string;
  readonly prediction: FixturePrediction;
}

interface ControlledTransport {
  readonly caller: PredictionMethodCaller;
  readonly calls: readonly TransportCall[];
}

interface HarnessController {
  readonly consumerEvents: string[];
  readonly ownerEffects: {
    cleanups: number;
    setups: number;
  };
  session: PredictionSessionContract | null;
}

interface HarnessCallbacks {
  readonly recordConsumerEvent: (event: string) => void;
  readonly recordOwnerCleanup: () => void;
  readonly recordOwnerSetup: () => void;
  readonly setSession: (session: PredictionSessionContract) => void;
}

interface HarnessProps {
  readonly consumerKey: string;
  readonly input: PredictionSessionInput;
  readonly ownerKey: string;
  readonly strictMode?: boolean;
}

interface SessionHarness {
  readonly controller: HarnessController;
  readonly rerender: (props: Partial<HarnessProps>) => Promise<void>;
  readonly session: () => PredictionSessionContract;
  readonly unmount: () => Promise<void>;
}

const activeUnmounts: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (activeUnmounts.length > 0) {
    const unmount = activeUnmounts.pop();
    if (unmount) {
      await unmount();
    }
  }
});

const createDeferred = <TValue>(): Deferred<TValue> => {
  let resolve!: (value: TValue) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<TValue>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    reject,
    resolve,
  };
};

const createControlledTransport = (): ControlledTransport => {
  const calls: TransportCall[] = [];
  const caller: PredictionMethodCaller = <TResult>(
    methodName: string,
    input: unknown,
  ) => {
    const deferred = createDeferred<TResult>();

    calls.push({
      deferred: deferred as Deferred<unknown>,
      input,
      methodName,
    });

    return deferred.promise;
  };

  return {
    caller,
    calls,
  };
};

const customQuestionConfig = () => ({
  ...defaultFixturePredictionQuestionConfig(),
  customQuestions: [
    {
      answerType: 'number' as const,
      countingDefinition: 'Scrum penalties against Team 2.',
      deductionPerUnit: 25,
      id: 'scrum-pressure',
      max: 12,
      min: 0,
      order: 1,
      prompt: 'How many scrum penalties against Team 2?',
    },
    {
      answerType: 'choice' as const,
      countingDefinition: 'Official player of the match group.',
      id: 'player-band',
      incorrectDeduction: 75,
      options: [
        { id: 'backs', label: 'Backs' },
        { id: 'forwards', label: 'Forwards' },
      ],
      order: 2,
      prompt: 'Which group produces the player of the match?',
    },
  ],
});

const fixtureForRuleset = (
  ruleset: RulesetSnapshot,
  fixtureId = 'fixture-1',
): FixtureDocument => ({
  _id: fixtureId,
  competitionDisplayName: 'Hook Cup',
  createdAt: now,
  createdByAdminId: 'admin-1',
  isCancelled: false,
  publishedAt: now,
  publishedByAdminId: 'admin-1',
  revision: 1,
  rulesetSnapshot: ruleset,
  scheduledKickoffAt: new Date('2098-06-01T12:00:00.000Z'),
  team1DisplayName: 'Springboks',
  team2DisplayName: 'All Blacks',
  updatedAt: now,
  updatedByAdminId: 'admin-1',
  visibility: 'published',
});

const validPrediction = (): FixturePrediction => ({
  firstTry: 'team1',
  halfTimeLeader: 'team1',
  highestScoringHalf: 'second',
  matchResult: 'team1',
  team1: {
    conversions: 2,
    dropGoals: 0,
    penaltyKicks: 1,
    redCards: 0,
    tries: 2,
    yellowCards: 1,
  },
  team2: {
    conversions: 1,
    dropGoals: 0,
    penaltyKicks: 1,
    redCards: 0,
    tries: 1,
    yellowCards: 0,
  },
});

const predictionEntry = ({
  fixtureId = 'fixture-1',
  prediction,
  revision,
  ruleset,
  userId = 'user-1',
}: {
  readonly fixtureId?: string;
  readonly prediction: FixturePrediction;
  readonly revision: number;
  readonly ruleset: RulesetSnapshot;
  readonly userId?: string;
}): PredictionEntryDocument => ({
  _id: `prediction-${fixtureId}-${revision}`,
  createdAt: now,
  fixtureId,
  prediction,
  revision,
  ruleset: {
    id: ruleset.id,
    schemaVersion: ruleset.schemaVersion,
    version: ruleset.version,
  },
  updatedAt: now,
  userId,
});

const mutationResult = ({
  fixtureId = 'fixture-1',
  revision,
  status = 'updated',
}: {
  readonly fixtureId?: string;
  readonly revision: number;
  readonly status?: PredictionMutationResult['status'];
}): PredictionMutationResult => ({
  fixtureId,
  predictionId: `prediction-${fixtureId}-${revision}`,
  revision,
  status,
});

const enterPredictionAnswers = async (
  harness: SessionHarness,
  prediction: FixturePrediction,
) => {
  await runAction(harness, (session) => {
    for (const side of ['team1', 'team2'] as const) {
      const team = prediction[side];

      session.actions.changeTeamNumericField(side, 'tries', String(team.tries));
      session.actions.changeTeamNumericField(
        side,
        'conversions',
        String(team.conversions ?? 0),
      );
      session.actions.changeTeamNumericField(
        side,
        'penaltyKicks',
        String(team.penaltyKicks),
      );
      session.actions.changeTeamNumericField(
        side,
        'dropGoals',
        String(team.dropGoals),
      );
      session.actions.changeTeamNumericField(
        side,
        'yellowCards',
        String(team.yellowCards ?? 0),
      );
      session.actions.changeTeamNumericField(
        side,
        'redCards',
        String(team.redCards ?? 0),
      );
    }

    session.actions.selectBuiltInChoice(
      'matchResult',
      prediction.matchResult ?? '',
    );
    session.actions.selectBuiltInChoice('firstTry', prediction.firstTry ?? '');
    session.actions.selectBuiltInChoice(
      'highestScoringHalf',
      prediction.highestScoringHalf ?? '',
    );
    session.actions.selectBuiltInChoice(
      'halfTimeLeader',
      prediction.halfTimeLeader ?? '',
    );

    for (const [questionId, value] of Object.entries(
      prediction.customAnswers ?? {},
    )) {
      session.actions.changeCustomAnswer(questionId, String(value));
    }
  });
};

const advanceToReview = async (harness: SessionHarness) => {
  await runAction(harness, (session) => {
    session.actions.startPrediction();

    for (let index = 0; index <= session.state.activeSteps.length; index += 1) {
      session.actions.continueForward();
    }
  });
};

const sessionInput = ({
  currentEntry,
  fixtureId = 'fixture-1',
  isReadOnly = false,
  ruleset = defaultRuleset,
  submitPredictionMethod,
  userId = 'user-1',
}: {
  readonly currentEntry?: PredictionEntryDocument | null;
  readonly fixtureId?: string;
  readonly isReadOnly?: boolean;
  readonly ruleset?: RulesetSnapshot;
  readonly submitPredictionMethod: PredictionMethodCaller;
  readonly userId?: string;
}): PredictionSessionInput => ({
  currentEntry,
  fixture: fixtureForRuleset(ruleset, fixtureId),
  fixtureId,
  initialExpectedRevision: currentEntry?.revision ?? null,
  initialForm: currentEntry
    ? formFromPrediction(currentEntry.prediction, ruleset)
    : emptyFormForRuleset(ruleset),
  isReadOnly,
  ruleset,
  submitPredictionMethod,
  userId,
});

const ConsumerProbe = ({
  callbacks,
  consumerKey,
  session,
}: {
  readonly callbacks: HarnessCallbacks;
  readonly consumerKey: string;
  readonly session: PredictionSessionContract;
}) => {
  callbacks.setSession(session);

  useEffect(() => {
    callbacks.recordConsumerEvent(`mount:${consumerKey}`);

    return () => {
      callbacks.recordConsumerEvent(`unmount:${consumerKey}`);
    };
  }, [callbacks, consumerKey]);

  return null;
};

const SessionHost = ({
  callbacks,
  consumerKey,
  input,
}: {
  readonly callbacks: HarnessCallbacks;
  readonly consumerKey: string;
  readonly input: PredictionSessionInput;
}) => {
  const session = usePredictionSession(input);

  useEffect(() => {
    callbacks.recordOwnerSetup();

    return () => {
      callbacks.recordOwnerCleanup();
    };
  }, [callbacks]);

  return createElement(ConsumerProbe, {
    key: consumerKey,
    callbacks,
    consumerKey,
    session,
  });
};

const renderHarnessElement = (
  props: HarnessProps,
  callbacks: HarnessCallbacks,
): ReactElement => {
  const host = createElement(SessionHost, {
    key: props.ownerKey,
    callbacks,
    consumerKey: props.consumerKey,
    input: props.input,
  });

  return props.strictMode ? createElement(StrictMode, null, host) : host;
};

const createSessionHarness = async (
  initialProps: HarnessProps,
): Promise<SessionHarness> => {
  const container = document.createElement('div');
  const controller: HarnessController = {
    consumerEvents: [],
    ownerEffects: {
      cleanups: 0,
      setups: 0,
    },
    session: null,
  };
  const callbacks: HarnessCallbacks = {
    recordConsumerEvent: (event) => {
      controller.consumerEvents.push(event);
    },
    recordOwnerCleanup: () => {
      controller.ownerEffects.cleanups += 1;
    },
    recordOwnerSetup: () => {
      controller.ownerEffects.setups += 1;
    },
    setSession: (session) => {
      controller.session = session;
    },
  };
  let props = initialProps;
  let isUnmounted = false;
  let root: Root | null = createRoot(container);

  document.body.append(container);

  const render = async () => {
    await act(async () => {
      root?.render(renderHarnessElement(props, callbacks));
    });
  };

  await render();

  const unmount = async () => {
    if (isUnmounted) {
      return;
    }

    isUnmounted = true;
    await act(async () => {
      root?.unmount();
    });
    root = null;
    controller.session = null;
    container.remove();
  };

  activeUnmounts.push(unmount);

  return {
    controller,
    rerender: async (nextProps) => {
      props = {
        ...props,
        ...nextProps,
      };
      await render();
    },
    session: () => {
      if (!controller.session) {
        throw new Error('Prediction session has not rendered.');
      }

      return controller.session;
    },
    unmount,
  };
};

const submitWithoutWaiting = async (
  harness: SessionHarness,
): Promise<{ readonly submitPromise: Promise<void> }> => {
  let submitPromise: Promise<void> = Promise.resolve();

  act(() => {
    submitPromise = harness.session().actions.submitPrediction();
  });
  await act(async () => {});

  return { submitPromise };
};

const runAction = async (
  harness: SessionHarness,
  action: (session: PredictionSessionContract) => void,
) => {
  act(() => {
    action(harness.session());
  });
  await act(async () => {});
};

const resolveTransportCall = async (
  call: TransportCall | undefined,
  value: PredictionMutationResult,
  submitPromise: Promise<void>,
) => {
  if (!call) {
    throw new Error('Expected a pending transport call.');
  }

  call.deferred.resolve(value);
  await act(async () => {
    await submitPromise;
  });
};

const rejectTransportCall = async (
  call: TransportCall | undefined,
  error: unknown,
  submitPromise: Promise<void>,
) => {
  if (!call) {
    throw new Error('Expected a pending transport call.');
  }

  call.deferred.reject(error);
  await act(async () => {
    await submitPromise;
  });
};

describe('prediction session hook lifecycle', () => {
  it('accepts successful save completion after StrictMode effect replay', async () => {
    const transport = createControlledTransport();
    const entry = predictionEntry({
      prediction: validPrediction(),
      revision: 7,
      ruleset: defaultRuleset,
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: sessionInput({
        currentEntry: entry,
        submitPredictionMethod: transport.caller,
      }),
      ownerKey: 'user-1:fixture-1',
      strictMode: true,
    });

    expect(harness.controller.ownerEffects.setups).toBeGreaterThanOrEqual(2);
    expect(harness.controller.ownerEffects.cleanups).toBeGreaterThanOrEqual(1);

    const { submitPromise } = await submitWithoutWaiting(harness);

    expect(harness.session().state.isSubmitting).toBe(true);
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.methodName).toBe(PREDICTION_METHODS.submit);

    await resolveTransportCall(
      transport.calls[0],
      mutationResult({
        revision: 8,
      }),
      submitPromise,
    );

    expect(harness.session().state.editSession.expectedRevision).toBe(8);
    expect(harness.session().state.feedback).toEqual({
      kind: 'success',
      message: 'Prediction updated.',
    });
    expect(harness.session().state.isSubmitting).toBe(false);
  });

  it('keeps edits made during a save dirty against the submitted snapshot', async () => {
    const ruleset = buildConfiguredRulesetSnapshot(customQuestionConfig());
    const transport = createControlledTransport();
    const submittedPrediction: FixturePrediction = {
      ...validPrediction(),
      customAnswers: {
        'player-band': 'backs',
        'scrum-pressure': 4,
      },
    };
    const entry = predictionEntry({
      prediction: submittedPrediction,
      revision: 7,
      ruleset,
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: sessionInput({
        currentEntry: entry,
        ruleset,
        submitPredictionMethod: transport.caller,
      }),
      ownerKey: 'user-1:fixture-1',
    });

    const { submitPromise } = await submitWithoutWaiting(harness);

    await runAction(harness, (session) => {
      session.actions.selectBuiltInChoice('halfTimeLeader', 'draw');
      session.actions.changeCustomAnswer('scrum-pressure', '6');
      session.actions.changeCustomAnswer('player-band', 'forwards');
    });

    const submittedInput = transport.calls[0]?.input as SubmitTransportInput;

    expect(submittedInput).toMatchObject({
      expectedRevision: 7,
      fixtureId: 'fixture-1',
      prediction: submittedPrediction,
    });

    await resolveTransportCall(
      transport.calls[0],
      mutationResult({
        revision: 8,
      }),
      submitPromise,
    );

    const state = harness.session().state;

    expect(state.editSession.expectedRevision).toBe(8);
    expect(state.persistedForm).toEqual(
      formFromPrediction(submittedPrediction, ruleset),
    );
    expect(state.form.halfTimeLeader).toBe('draw');
    expect(state.form.customAnswers['scrum-pressure']).toBe('6');
    expect(state.form.customAnswers['player-band']).toBe('forwards');
    expect(state.hasUnsavedChanges).toBe(true);
  });

  it('keeps an acknowledged revision clean while publication is absent or older', async () => {
    const transport = createControlledTransport();
    const originalPrediction = validPrediction();
    const submittedPrediction: FixturePrediction = {
      ...validPrediction(),
      halfTimeLeader: 'draw',
    };
    const originalEntry = predictionEntry({
      prediction: originalPrediction,
      revision: 1,
      ruleset: defaultRuleset,
    });
    const matchingEntry = predictionEntry({
      prediction: submittedPrediction,
      revision: 2,
      ruleset: defaultRuleset,
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: sessionInput({
        currentEntry: originalEntry,
        submitPredictionMethod: transport.caller,
      }),
      ownerKey: 'user-1:fixture-1',
    });

    await runAction(harness, (session) => {
      session.actions.selectBuiltInChoice('halfTimeLeader', 'draw');
    });

    const { submitPromise } = await submitWithoutWaiting(harness);

    expect(
      (transport.calls[0]?.input as SubmitTransportInput).prediction,
    ).toEqual(submittedPrediction);

    await resolveTransportCall(
      transport.calls[0],
      mutationResult({
        revision: 2,
      }),
      submitPromise,
    );

    expect(harness.session().state.persistedForm).toEqual(
      formFromPrediction(submittedPrediction, defaultRuleset),
    );
    expect(harness.session().state.hasUnsavedChanges).toBe(false);
    expect(harness.session().state.savedEntryChanged).toBe(false);

    await harness.rerender({
      input: sessionInput({
        currentEntry: null,
        submitPredictionMethod: transport.caller,
      }),
    });

    expect(harness.session().state.hasUnsavedChanges).toBe(false);
    expect(harness.session().state.savedEntryChanged).toBe(false);

    await harness.rerender({
      input: sessionInput({
        currentEntry: originalEntry,
        submitPredictionMethod: transport.caller,
      }),
    });

    expect(harness.session().state.hasUnsavedChanges).toBe(false);
    expect(harness.session().state.savedEntryChanged).toBe(false);

    await harness.rerender({
      input: sessionInput({
        currentEntry: matchingEntry,
        submitPredictionMethod: transport.caller,
      }),
    });

    expect(harness.session().state.form).toEqual(
      formFromPrediction(submittedPrediction, defaultRuleset),
    );
    expect(harness.session().state.hasUnsavedChanges).toBe(false);
    expect(harness.session().state.savedEntryChanged).toBe(false);
  });

  it('discards to an acknowledged first save while publication still lags', async () => {
    const transport = createControlledTransport();
    const submittedPrediction = validPrediction();
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: sessionInput({
        currentEntry: null,
        submitPredictionMethod: transport.caller,
      }),
      ownerKey: 'user-1:fixture-1',
    });

    await enterPredictionAnswers(harness, submittedPrediction);
    await advanceToReview(harness);

    const { submitPromise } = await submitWithoutWaiting(harness);

    await resolveTransportCall(
      transport.calls[0],
      mutationResult({
        revision: 1,
        status: 'created',
      }),
      submitPromise,
    );

    await runAction(harness, (session) => {
      session.actions.selectBuiltInChoice('halfTimeLeader', 'draw');
      session.actions.requestDiscardChanges();
      session.actions.confirmDiscardChanges();
    });

    const state = harness.session().state;

    expect(state.form).toEqual(
      formFromPrediction(submittedPrediction, defaultRuleset),
    );
    expect(state.editSession.expectedRevision).toBe(1);
    expect(state.location).toEqual({ kind: 'review' });
    expect(state.hasUnsavedChanges).toBe(false);
    expect(transport.calls).toHaveLength(1);
  });

  it('keeps dirty answers and captured revision when a genuinely newer entry publishes', async () => {
    const transport = createControlledTransport();
    const originalPrediction = validPrediction();
    const latestPrediction: FixturePrediction = {
      ...validPrediction(),
      halfTimeLeader: 'draw',
      team1: {
        ...validPrediction().team1,
        tries: 1,
      },
    };
    const originalEntry = predictionEntry({
      prediction: originalPrediction,
      revision: 1,
      ruleset: defaultRuleset,
    });
    const latestEntry = predictionEntry({
      prediction: latestPrediction,
      revision: 2,
      ruleset: defaultRuleset,
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: sessionInput({
        currentEntry: originalEntry,
        submitPredictionMethod: transport.caller,
      }),
      ownerKey: 'user-1:fixture-1',
    });

    await runAction(harness, (session) => {
      session.actions.changeTeamNumericField('team1', 'tries', '5');
    });

    await harness.rerender({
      input: sessionInput({
        currentEntry: latestEntry,
        submitPredictionMethod: transport.caller,
      }),
    });

    expect(harness.session().state.form.team1.tries).toBe('5');
    expect(harness.session().state.editSession.expectedRevision).toBe(1);
    expect(harness.session().state.savedEntryChanged).toBe(true);

    await runAction(harness, (session) => {
      session.actions.loadLatestSavedPrediction();
    });

    expect(harness.session().state.form).toEqual(
      formFromPrediction(latestPrediction, defaultRuleset),
    );
    expect(harness.session().state.editSession.expectedRevision).toBe(2);

    await harness.rerender({
      input: sessionInput({
        currentEntry: null,
        submitPredictionMethod: transport.caller,
      }),
    });

    expect(harness.session().state.persistedForm).toEqual(
      formFromPrediction(latestPrediction, defaultRuleset),
    );
    expect(harness.session().state.editSession.expectedRevision).toBe(2);

    await harness.rerender({
      input: sessionInput({
        currentEntry: originalEntry,
        submitPredictionMethod: transport.caller,
      }),
    });

    expect(harness.session().state.persistedForm).toEqual(
      formFromPrediction(latestPrediction, defaultRuleset),
    );
  });

  it('does not regress a newer published baseline when an older acknowledgement arrives', async () => {
    const transport = createControlledTransport();
    const submittedPrediction = validPrediction();
    const newerPrediction: FixturePrediction = {
      ...validPrediction(),
      halfTimeLeader: 'draw',
    };
    const originalEntry = predictionEntry({
      prediction: submittedPrediction,
      revision: 1,
      ruleset: defaultRuleset,
    });
    const newerEntry = predictionEntry({
      prediction: newerPrediction,
      revision: 3,
      ruleset: defaultRuleset,
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: sessionInput({
        currentEntry: originalEntry,
        submitPredictionMethod: transport.caller,
      }),
      ownerKey: 'user-1:fixture-1',
    });
    const { submitPromise } = await submitWithoutWaiting(harness);

    await harness.rerender({
      input: sessionInput({
        currentEntry: newerEntry,
        submitPredictionMethod: transport.caller,
      }),
    });

    expect(harness.session().state.savedEntryChanged).toBe(true);

    await resolveTransportCall(
      transport.calls[0],
      mutationResult({
        revision: 2,
      }),
      submitPromise,
    );

    const state = harness.session().state;

    expect(state.editSession.expectedRevision).toBe(2);
    expect(state.persistedForm).toEqual(
      formFromPrediction(newerPrediction, defaultRuleset),
    );
    expect(state.savedEntryChanged).toBe(true);
    expect(state.hasUnsavedChanges).toBe(true);
  });

  it('surfaces failed save completion after StrictMode replay and permits a later attempt', async () => {
    const transport = createControlledTransport();
    const entry = predictionEntry({
      prediction: validPrediction(),
      revision: 7,
      ruleset: defaultRuleset,
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: sessionInput({
        currentEntry: entry,
        submitPredictionMethod: transport.caller,
      }),
      ownerKey: 'user-1:fixture-1',
      strictMode: true,
    });

    await runAction(harness, (session) => {
      session.actions.selectBuiltInChoice('halfTimeLeader', 'draw');
    });

    const { submitPromise } = await submitWithoutWaiting(harness);

    await rejectTransportCall(
      transport.calls[0],
      {
        error: 'network-down',
        reason: 'The save transport failed.',
      },
      submitPromise,
    );

    expect(harness.session().state.feedback).toEqual({
      code: 'network-down',
      kind: 'error',
      message: 'The save transport failed.',
    });
    expect(harness.session().state.form.halfTimeLeader).toBe('draw');
    expect(harness.session().state.persistedForm).toEqual(
      formFromPrediction(validPrediction(), defaultRuleset),
    );
    expect(harness.session().state.hasUnsavedChanges).toBe(true);
    expect(harness.session().state.isSubmitting).toBe(false);

    const { submitPromise: retryPromise } = await submitWithoutWaiting(harness);

    expect(transport.calls).toHaveLength(2);

    await resolveTransportCall(
      transport.calls[1],
      mutationResult({
        revision: 8,
      }),
      retryPromise,
    );

    expect(harness.session().state.editSession.expectedRevision).toBe(8);
    expect(harness.session().state.feedback?.kind).toBe('success');
    expect(harness.session().state.isSubmitting).toBe(false);
  });

  it('preserves edits and the saved baseline after a stale conflict', async () => {
    const transport = createControlledTransport();
    const entry = predictionEntry({
      prediction: validPrediction(),
      revision: 7,
      ruleset: defaultRuleset,
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: sessionInput({
        currentEntry: entry,
        submitPredictionMethod: transport.caller,
      }),
      ownerKey: 'user-1:fixture-1',
    });

    await runAction(harness, (session) => {
      session.actions.selectBuiltInChoice('halfTimeLeader', 'draw');
    });

    const { submitPromise } = await submitWithoutWaiting(harness);

    await rejectTransportCall(
      transport.calls[0],
      {
        error: 'prediction-conflict',
        reason: 'Saved prediction changed. Load the latest saved prediction.',
      },
      submitPromise,
    );

    const state = harness.session().state;

    expect(state.feedback).toEqual({
      code: 'prediction-conflict',
      kind: 'error',
      message: 'Saved prediction changed. Load the latest saved prediction.',
    });
    expect(state.form.halfTimeLeader).toBe('draw');
    expect(state.persistedForm).toEqual(
      formFromPrediction(validPrediction(), defaultRuleset),
    );
    expect(state.editSession.expectedRevision).toBe(7);
    expect(state.hasUnsavedChanges).toBe(true);
    expect(state.isPredictionConflict).toBe(true);
  });

  it('preserves the owner session when only the presentation consumer is replaced', async () => {
    const ruleset = buildConfiguredRulesetSnapshot(customQuestionConfig());
    const transport = createControlledTransport();
    const entry = predictionEntry({
      prediction: {
        ...validPrediction(),
        customAnswers: {
          'player-band': 'backs',
          'scrum-pressure': 4,
        },
      },
      revision: 7,
      ruleset,
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: sessionInput({
        currentEntry: entry,
        ruleset,
        submitPredictionMethod: transport.caller,
      }),
      ownerKey: 'user-1:fixture-1',
    });

    await runAction(harness, (session) => {
      session.actions.selectBuiltInChoice('halfTimeLeader', 'draw');
      session.actions.editStep('custom:scrum-pressure');
      session.actions.changeCustomAnswer('scrum-pressure', '6');
      session.actions.returnToReview();
      session.actions.changeCustomAnswer('player-band', 'forwards');
      session.actions.editStep('custom:player-band');
    });

    const beforeReplacement = harness.session().state;
    const eventCount = harness.controller.consumerEvents.length;

    await harness.rerender({
      consumerKey: 'standard-b',
    });

    const replacementEvents =
      harness.controller.consumerEvents.slice(eventCount);
    const afterReplacement = harness.session().state;

    expect(replacementEvents).toContain('unmount:standard-a');
    expect(replacementEvents).toContain('mount:standard-b');
    expect(afterReplacement.form.halfTimeLeader).toBe('draw');
    expect(afterReplacement.form.customAnswers['scrum-pressure']).toBe('6');
    expect(afterReplacement.form.customAnswers['player-band']).toBe('forwards');
    expect(afterReplacement.location).toEqual({
      kind: 'step',
      stepId: 'custom:player-band',
    });
    expect(afterReplacement.isEditingFromReview).toBe(true);
    expect(afterReplacement.messageSelection).toBe(
      beforeReplacement.messageSelection,
    );
    expect(afterReplacement.editSession.expectedRevision).toBe(7);
    expect(transport.calls).toHaveLength(0);
  });

  it('lets a replacement consumer receive a legitimate in-flight save completion', async () => {
    const transport = createControlledTransport();
    const entry = predictionEntry({
      prediction: validPrediction(),
      revision: 7,
      ruleset: defaultRuleset,
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: sessionInput({
        currentEntry: entry,
        submitPredictionMethod: transport.caller,
      }),
      ownerKey: 'user-1:fixture-1',
    });
    const { submitPromise } = await submitWithoutWaiting(harness);

    expect(harness.session().state.isSubmitting).toBe(true);

    const eventCount = harness.controller.consumerEvents.length;

    await harness.rerender({
      consumerKey: 'standard-b',
    });

    expect(harness.controller.consumerEvents.slice(eventCount)).toContain(
      'unmount:standard-a',
    );
    expect(harness.session().state.isSubmitting).toBe(true);

    await resolveTransportCall(
      transport.calls[0],
      mutationResult({
        revision: 8,
      }),
      submitPromise,
    );

    expect(transport.calls).toHaveLength(1);
    expect(harness.session().state.editSession.expectedRevision).toBe(8);
    expect(harness.session().state.feedback?.kind).toBe('success');
    expect(harness.session().state.isSubmitting).toBe(false);
  });

  it('uses the real submit command boundary to block duplicate submissions', async () => {
    const transport = createControlledTransport();
    const entry = predictionEntry({
      prediction: validPrediction(),
      revision: 7,
      ruleset: defaultRuleset,
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: sessionInput({
        currentEntry: entry,
        submitPredictionMethod: transport.caller,
      }),
      ownerKey: 'user-1:fixture-1',
    });
    let firstSubmit: Promise<void> = Promise.resolve();
    let secondSubmit: Promise<void> = Promise.resolve();

    act(() => {
      firstSubmit = harness.session().actions.submitPrediction();
      secondSubmit = harness.session().actions.submitPrediction();
    });
    await act(async () => {});

    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.input).toMatchObject({
      expectedRevision: 7,
      fixtureId: 'fixture-1',
    });
    expect(harness.session().state.isSubmitting).toBe(true);

    await resolveTransportCall(
      transport.calls[0],
      mutationResult({
        revision: 8,
      }),
      firstSubmit,
    );
    await act(async () => {
      await firstSubmit;
      await secondSubmit;
    });

    expect(harness.session().state.editSession.expectedRevision).toBe(8);
    expect(harness.session().state.isSubmitting).toBe(false);
  });

  it('keeps updated read-only context authoritative for real hook commands', async () => {
    const transport = createControlledTransport();
    const entry = predictionEntry({
      prediction: validPrediction(),
      revision: 7,
      ruleset: defaultRuleset,
    });
    const editableInput = sessionInput({
      currentEntry: entry,
      submitPredictionMethod: transport.caller,
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: editableInput,
      ownerKey: 'user-1:fixture-1',
    });

    await runAction(harness, (session) => {
      session.actions.selectBuiltInChoice('halfTimeLeader', 'draw');
    });

    expect(harness.session().state.form.halfTimeLeader).toBe('draw');

    await harness.rerender({
      input: {
        ...editableInput,
        isReadOnly: true,
      },
    });

    const beforeCommands = harness.session().state;

    expect(beforeCommands.isReadOnly).toBe(true);
    expect(beforeCommands.navigation.canSubmit).toBe(false);
    expect(beforeCommands.navigation.canGoBack).toBe(false);

    await runAction(harness, (session) => {
      session.actions.selectBuiltInChoice('halfTimeLeader', 'team2');
      session.actions.changeTeamNumericField('team1', 'tries', '9');
      session.actions.changeCustomAnswer('unknown', 'value');
      session.actions.editStep('tries');
      session.actions.startPrediction();
      session.actions.continueForward();
      void session.actions.submitPrediction();
    });

    expect(harness.session().state.form).toEqual(beforeCommands.form);
    expect(harness.session().state.location).toEqual(beforeCommands.location);
    expect(transport.calls).toHaveLength(0);
  });

  it('hydrates from a saved entry that arrives after an untouched blank hook mount', async () => {
    const transport = createControlledTransport();
    const blankInput = sessionInput({
      currentEntry: null,
      submitPredictionMethod: transport.caller,
    });
    const entry = predictionEntry({
      prediction: validPrediction(),
      revision: 7,
      ruleset: defaultRuleset,
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: blankInput,
      ownerKey: 'user-1:fixture-1',
    });

    expect(harness.session().state.location).toEqual({ kind: 'intro' });
    expect(harness.session().state.editSession.expectedRevision).toBeNull();

    await harness.rerender({
      input: sessionInput({
        currentEntry: entry,
        submitPredictionMethod: transport.caller,
      }),
    });

    expect(harness.session().state.location).toEqual({ kind: 'review' });
    expect(harness.session().state.editSession.expectedRevision).toBe(7);
    expect(harness.session().state.form).toEqual(
      formFromPrediction(validPrediction(), defaultRuleset),
    );
  });

  it('keeps edited blank hook state when a saved entry arrives late', async () => {
    const transport = createControlledTransport();
    const blankInput = sessionInput({
      currentEntry: null,
      submitPredictionMethod: transport.caller,
    });
    const entry = predictionEntry({
      prediction: validPrediction(),
      revision: 7,
      ruleset: defaultRuleset,
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: blankInput,
      ownerKey: 'user-1:fixture-1',
    });

    await runAction(harness, (session) => {
      session.actions.startPrediction();
      session.actions.selectBuiltInChoice('matchResult', 'team2');
    });

    expect(harness.session().state.location).toEqual({
      kind: 'step',
      stepId: 'match-result',
    });
    expect(harness.session().state.form.matchResult).toBe('team2');

    await harness.rerender({
      input: sessionInput({
        currentEntry: entry,
        submitPredictionMethod: transport.caller,
      }),
    });

    expect(harness.session().state.location).toEqual({
      kind: 'step',
      stepId: 'match-result',
    });
    expect(harness.session().state.form.matchResult).toBe('team2');
    expect(harness.session().state.editSession.expectedRevision).toBeNull();
  });

  it('isolates stale completion from a disposed owner while the replacement session is submitting', async () => {
    const transport = createControlledTransport();
    const entryA = predictionEntry({
      fixtureId: 'fixture-a',
      prediction: validPrediction(),
      revision: 7,
      ruleset: defaultRuleset,
      userId: 'user-a',
    });
    const entryB = predictionEntry({
      fixtureId: 'fixture-b',
      prediction: {
        ...validPrediction(),
        halfTimeLeader: 'draw',
      },
      revision: 10,
      ruleset: defaultRuleset,
      userId: 'user-b',
    });
    const inputA = sessionInput({
      currentEntry: entryA,
      fixtureId: 'fixture-a',
      submitPredictionMethod: transport.caller,
      userId: 'user-a',
    });
    const inputB = sessionInput({
      currentEntry: entryB,
      fixtureId: 'fixture-b',
      submitPredictionMethod: transport.caller,
      userId: 'user-b',
    });
    const harness = await createSessionHarness({
      consumerKey: 'standard-a',
      input: inputA,
      ownerKey: 'user-a:fixture-a',
    });
    const { submitPromise: submitA } = await submitWithoutWaiting(harness);

    expect(transport.calls).toHaveLength(1);
    expect(harness.session().state.isSubmitting).toBe(true);

    await harness.rerender({
      consumerKey: 'standard-b',
      input: inputB,
      ownerKey: 'user-b:fixture-b',
    });

    expect(harness.session().state.form.halfTimeLeader).toBe('draw');
    expect(harness.session().state.editSession.expectedRevision).toBe(10);
    expect(harness.session().state.isSubmitting).toBe(false);

    const { submitPromise: submitB } = await submitWithoutWaiting(harness);

    expect(transport.calls).toHaveLength(2);
    expect(harness.session().state.isSubmitting).toBe(true);

    await resolveTransportCall(
      transport.calls[0],
      mutationResult({
        fixtureId: 'fixture-a',
        revision: 99,
      }),
      submitA,
    );

    expect(harness.session().state.form.halfTimeLeader).toBe('draw');
    expect(harness.session().state.feedback).toBeNull();
    expect(harness.session().state.editSession.expectedRevision).toBe(10);
    expect(harness.session().state.location).toEqual({ kind: 'review' });
    expect(harness.session().state.isSubmitting).toBe(true);

    await resolveTransportCall(
      transport.calls[1],
      mutationResult({
        fixtureId: 'fixture-b',
        revision: 11,
      }),
      submitB,
    );

    expect(harness.session().state.editSession.expectedRevision).toBe(11);
    expect(harness.session().state.isSubmitting).toBe(false);
  });
});
