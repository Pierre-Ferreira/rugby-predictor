import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react';
import { Random } from 'meteor/random';

import {
  FIXTURE_METHODS,
  type FixtureDocument,
} from '/imports/shared/fixtures';
import {
  MAX_CUSTOM_QUESTIONS_PER_FIXTURE,
  PREDICTION_QUESTION_CONFIG_SCHEMA_VERSION,
  buildConfiguredRulesetSnapshot,
  normalizeFixturePredictionQuestionConfig,
  optionalStandardQuestionIds,
  permanentCoreQuestionIds,
  predictionQuestionConfigForFixture,
  type CustomChoiceQuestionConfig,
  type CustomNumberQuestionConfig,
  type CustomQuestionConfig,
  type FixturePredictionQuestionConfig,
  type FixtureQuestionConfigMutationResult,
  type OptionalStandardQuestionConfig,
  type OptionalStandardQuestionId,
} from '/imports/shared/predictionQuestions';
import {
  defaultRuleset,
  type QuestionDefinition,
  type RulesetSnapshot,
} from '/imports/shared/scoring';
import { activePredictionSteps } from '/imports/shared/predictions';
import { callMeteorMethod } from '../auth/methodCall';

export interface QuestionConfigSession {
  readonly config: FixturePredictionQuestionConfig;
  readonly expectedRevision: number;
  readonly fixtureId: string;
  readonly fixtureLabel: string;
}

interface AdminFixtureQuestionConfiguratorProps {
  readonly currentFixture: FixtureDocument | null;
  readonly onClose: () => void;
  readonly onReload: () => void;
  readonly onSaved: (
    session: Pick<QuestionConfigSession, 'config' | 'expectedRevision'>,
  ) => void;
  readonly session: QuestionConfigSession;
}

const formatPoints = (value: number): string => value.toLocaleString('en-US');

const newStableId = (prefix: string): string =>
  `${prefix}-${Random.id(10).toLocaleLowerCase('en-US')}`;

const questionById = (
  ruleset: RulesetSnapshot,
  id: string,
): QuestionDefinition | null =>
  ruleset.questions.find((question) => question.id === id) ?? null;

const coreDeductionText = (question: QuestionDefinition | null): string => {
  if (!question) {
    return 'Configured by the active scoring rules.';
  }

  if (question.type === 'built-in-categorical') {
    return `Incorrect: -${formatPoints(question.incorrectDeduction)} points`;
  }

  if (question.type === 'built-in-team-numeric') {
    if (question.id === 'team-score') {
      return `-${formatPoints(question.rate)} points per final-score point difference, per team`;
    }

    return `-${formatPoints(question.rate)} points per difference, per team`;
  }

  return 'Configured by the active scoring rules.';
};

const standardQuestionLabel = (id: OptionalStandardQuestionId): string => {
  if (id === 'first-try') {
    return 'First try';
  }

  if (id === 'highest-scoring-half') {
    return 'Highest-scoring half';
  }

  return 'Half-time leader';
};

const customTypeLabel = (question: CustomQuestionConfig): string =>
  question.answerType === 'number' ? 'Number' : 'Choice';

const emptyConfig = (): FixturePredictionQuestionConfig => ({
  customQuestions: [],
  optionalStandardQuestions: optionalStandardQuestionIds.map((id) => ({
    enabled: true,
    id,
    incorrectDeduction: 250,
  })),
  schemaVersion: PREDICTION_QUESTION_CONFIG_SCHEMA_VERSION,
});

const newNumberQuestion = (): CustomNumberQuestionConfig => ({
  answerType: 'number',
  countingDefinition: '',
  deductionPerUnit: 1,
  id: newStableId('custom-number'),
  max: 10,
  min: 0,
  order: 1,
  prompt: '',
});

const newChoiceQuestion = (): CustomChoiceQuestionConfig => ({
  answerType: 'choice',
  countingDefinition: '',
  id: newStableId('custom-choice'),
  incorrectDeduction: 1,
  options: [
    {
      id: newStableId('option'),
      label: '',
    },
    {
      id: newStableId('option'),
      label: '',
    },
  ],
  order: 1,
  prompt: '',
});

const parseIntegerInput = (value: string): number => {
  if (value.trim() === '') {
    return 0;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
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

  return 'The question configuration could not be saved.';
};

export const AdminFixtureQuestionConfigurator = ({
  currentFixture,
  onClose,
  onReload,
  onSaved,
  session,
}: AdminFixtureQuestionConfiguratorProps) => {
  const [form, setForm] = useState<FixturePredictionQuestionConfig>(
    session.config,
  );
  const [feedback, setFeedback] = useState<{
    readonly code?: string;
    readonly kind: 'error' | 'success';
    readonly message: string;
  } | null>(null);
  const [pendingSave, setPendingSave] = useState(false);

  const readOnly = Boolean(
    currentFixture &&
    (currentFixture.visibility === 'published' || currentFixture.isCancelled),
  );
  const rulesetForCore = currentFixture?.rulesetSnapshot ?? defaultRuleset;
  const projectedActiveStepCount = useMemo(() => {
    try {
      return activePredictionSteps(buildConfiguredRulesetSnapshot(form)).length;
    } catch {
      return null;
    }
  }, [form]);
  const hasCustomQuestions = form.customQuestions.length > 0;
  const hasConflict = feedback?.code === 'fixture-conflict';

  const updateOptionalQuestion = (
    id: OptionalStandardQuestionId,
    patch: Partial<OptionalStandardQuestionConfig>,
  ) => {
    setForm((current) => ({
      ...current,
      optionalStandardQuestions: current.optionalStandardQuestions.map(
        (question) =>
          question.id === id
            ? {
                ...question,
                ...patch,
              }
            : question,
      ),
    }));
  };

  const updateCustomQuestion = (
    id: string,
    patch: Partial<CustomQuestionConfig>,
  ) => {
    setForm((current) => ({
      ...current,
      customQuestions: current.customQuestions.map((question) =>
        question.id === id
          ? ({
              ...question,
              ...patch,
            } as CustomQuestionConfig)
          : question,
      ),
    }));
  };

  const updateChoiceOption = (
    questionId: string,
    optionId: string,
    label: string,
  ) => {
    setForm((current) => ({
      ...current,
      customQuestions: current.customQuestions.map((question) => {
        if (question.id !== questionId || question.answerType !== 'choice') {
          return question;
        }

        return {
          ...question,
          options: question.options.map((option) =>
            option.id === optionId
              ? {
                  ...option,
                  label,
                }
              : option,
          ),
        };
      }),
    }));
  };

  const addChoiceOption = (questionId: string) => {
    setForm((current) => ({
      ...current,
      customQuestions: current.customQuestions.map((question) => {
        if (question.id !== questionId || question.answerType !== 'choice') {
          return question;
        }

        return {
          ...question,
          options: [
            ...question.options,
            {
              id: newStableId('option'),
              label: '',
            },
          ],
        };
      }),
    }));
  };

  const removeChoiceOption = (questionId: string, optionId: string) => {
    setForm((current) => ({
      ...current,
      customQuestions: current.customQuestions.map((question) => {
        if (question.id !== questionId || question.answerType !== 'choice') {
          return question;
        }

        return {
          ...question,
          options: question.options.filter((option) => option.id !== optionId),
        };
      }),
    }));
  };

  const addCustomQuestion = (question: CustomQuestionConfig) => {
    if (form.customQuestions.length >= MAX_CUSTOM_QUESTIONS_PER_FIXTURE) {
      setFeedback({
        kind: 'error',
        message: `Maximum of ${MAX_CUSTOM_QUESTIONS_PER_FIXTURE} custom questions.`,
      });
      return;
    }

    setForm((current) => ({
      ...current,
      customQuestions: [...current.customQuestions, question],
    }));
    setFeedback(null);
  };

  const removeCustomQuestion = (id: string) => {
    setForm((current) => ({
      ...current,
      customQuestions: current.customQuestions.filter(
        (question) => question.id !== id,
      ),
    }));
  };

  const moveCustomQuestion = (id: string, direction: -1 | 1) => {
    setForm((current) => {
      const index = current.customQuestions.findIndex(
        (question) => question.id === id,
      );
      const targetIndex = index + direction;

      if (
        index === -1 ||
        targetIndex < 0 ||
        targetIndex >= current.customQuestions.length
      ) {
        return current;
      }

      const next = [...current.customQuestions];
      const [question] = next.splice(index, 1);
      next.splice(targetIndex, 0, question);

      return {
        ...current,
        customQuestions: next,
      };
    });
  };

  const saveConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    let normalized: FixturePredictionQuestionConfig;

    try {
      normalized = normalizeFixturePredictionQuestionConfig(form);
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: messageFromError(error),
      });
      return;
    }

    setPendingSave(true);

    try {
      const result =
        await callMeteorMethod<FixtureQuestionConfigMutationResult>(
          FIXTURE_METHODS.saveQuestionConfig,
          {
            config: normalized,
            expectedRevision: session.expectedRevision,
            fixtureId: session.fixtureId,
          },
        );

      setForm(normalized);
      onSaved({
        config: normalized,
        expectedRevision: result.revision,
      });
      setFeedback({
        kind: 'success',
        message: 'Prediction question configuration saved.',
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
      setPendingSave(false);
    }
  };

  return (
    <section className="mt-8 rounded-md border border-rooster-line p-4">
      <form onSubmit={saveConfig}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase text-rooster-red">
              Prediction questions
            </p>
            <h2 className="mt-2 text-2xl font-black text-rooster-ink">
              {session.fixtureLabel}
            </h2>
            <p className="mt-2 text-sm font-bold text-rooster-muted">
              Revision {session.expectedRevision}
              {readOnly ? ' · Read-only' : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pendingSave || !currentFixture}
              type="button"
              onClick={() => {
                if (currentFixture) {
                  setForm(predictionQuestionConfigForFixture(currentFixture));
                }
                setFeedback(null);
                onReload();
              }}
            >
              Reload
            </button>
            <button
              className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-paper"
              type="button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {feedback ? (
          <p
            className={[
              'mt-4 rounded-md border px-3 py-2 text-sm font-bold',
              feedback.kind === 'success'
                ? 'border-rooster-grass/30 bg-rooster-grass/10 text-rooster-grass'
                : 'border-rooster-red/30 bg-rooster-red/10 text-rooster-red',
            ].join(' ')}
            role={feedback.kind === 'error' ? 'alert' : 'status'}
          >
            {feedback.message}
          </p>
        ) : null}

        {hasConflict ? (
          <p className="mt-4 rounded-md border border-rooster-red/30 bg-rooster-red/10 px-3 py-2 text-sm font-bold text-rooster-red">
            Unsaved question values remain in this editor. Reload replaces them
            with the latest fixture configuration.
          </p>
        ) : null}

        {hasCustomQuestions ? (
          <p className="mt-4 rounded-md border border-rooster-grass/30 bg-rooster-grass/10 px-3 py-2 text-sm font-bold text-rooster-ink">
            Custom questions will appear after the active standard prediction
            steps when this fixture is published.
          </p>
        ) : null}

        <div className="mt-6 grid gap-6">
          <section className="rounded-md border border-rooster-line p-4">
            <div>
              <p className="text-xs font-black uppercase text-rooster-muted">
                Core
              </p>
              <h3 className="mt-1 text-lg font-black text-rooster-ink">
                Always included
              </h3>
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {permanentCoreQuestionIds.map((id) => {
                const question = questionById(rulesetForCore, id);

                return (
                  <li
                    className="rounded-md border border-rooster-line bg-rooster-paper px-3 py-3"
                    key={id}
                  >
                    <p className="font-black text-rooster-ink">
                      {question?.label ?? id}
                    </p>
                    <p className="mt-1 text-xs font-black uppercase text-rooster-muted">
                      Core question
                    </p>
                    <p className="mt-2 text-sm text-rooster-muted">
                      {coreDeductionText(question)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-md border border-rooster-line p-4">
            <div>
              <p className="text-xs font-black uppercase text-rooster-muted">
                Optional
              </p>
              <h3 className="mt-1 text-lg font-black text-rooster-ink">
                Standard questions
              </h3>
            </div>
            <div className="mt-4 grid gap-3">
              {form.optionalStandardQuestions.map((question) => (
                <div
                  className="grid gap-3 rounded-md border border-rooster-line p-3 sm:grid-cols-[minmax(0,1fr)_11rem]"
                  key={question.id}
                >
                  <label className="flex min-h-11 items-center gap-3 text-sm font-black text-rooster-ink">
                    <input
                      checked={question.enabled}
                      className="h-5 w-5"
                      disabled={readOnly || pendingSave}
                      type="checkbox"
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        updateOptionalQuestion(question.id, {
                          enabled: event.target.checked,
                        })
                      }
                    />
                    <span>{standardQuestionLabel(question.id)}</span>
                  </label>
                  <label className="grid gap-1 text-sm font-bold text-rooster-ink">
                    Incorrect deduction
                    <input
                      aria-label={`${standardQuestionLabel(
                        question.id,
                      )} incorrect deduction`}
                      className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 py-2 font-normal"
                      disabled={readOnly || pendingSave}
                      inputMode="numeric"
                      min={1}
                      type="number"
                      value={question.incorrectDeduction}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        updateOptionalQuestion(question.id, {
                          incorrectDeduction: parseIntegerInput(
                            event.target.value,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-rooster-line p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-rooster-muted">
                  Custom
                </p>
                <h3 className="mt-1 text-lg font-black text-rooster-ink">
                  Fixture-specific questions
                </h3>
                <p className="mt-1 text-sm font-bold text-rooster-muted">
                  {form.customQuestions.length} of{' '}
                  {MAX_CUSTOM_QUESTIONS_PER_FIXTURE}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    readOnly ||
                    pendingSave ||
                    form.customQuestions.length >=
                      MAX_CUSTOM_QUESTIONS_PER_FIXTURE
                  }
                  type="button"
                  onClick={() => addCustomQuestion(newNumberQuestion())}
                >
                  Add Number
                </button>
                <button
                  className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    readOnly ||
                    pendingSave ||
                    form.customQuestions.length >=
                      MAX_CUSTOM_QUESTIONS_PER_FIXTURE
                  }
                  type="button"
                  onClick={() => addCustomQuestion(newChoiceQuestion())}
                >
                  Add Choice
                </button>
              </div>
            </div>

            {form.customQuestions.length === 0 ? (
              <p className="mt-4 rounded-md border border-dashed border-rooster-line bg-rooster-paper px-4 py-5 text-sm font-bold text-rooster-muted">
                No custom questions configured.
              </p>
            ) : (
              <div className="mt-4 grid gap-4">
                {form.customQuestions.map((question, index) => (
                  <CustomQuestionEditor
                    key={question.id}
                    disabled={readOnly || pendingSave}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === form.customQuestions.length - 1}
                    question={question}
                    onAddChoiceOption={addChoiceOption}
                    onMove={moveCustomQuestion}
                    onRemove={removeCustomQuestion}
                    onRemoveChoiceOption={removeChoiceOption}
                    onUpdate={updateCustomQuestion}
                    onUpdateChoiceOption={updateChoiceOption}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-rooster-red px-4 text-sm font-black text-white transition hover:bg-rooster-ink disabled:cursor-not-allowed disabled:opacity-60"
            disabled={readOnly || pendingSave}
            type="submit"
          >
            {pendingSave ? 'Saving' : 'Save prediction questions'}
          </button>
          {readOnly ? (
            <p className="text-sm font-bold text-rooster-muted">
              Published and cancelled fixtures are read-only.
            </p>
          ) : null}
          <p className="text-sm font-bold text-rooster-muted">
            Projected player steps:{' '}
            {projectedActiveStepCount ?? 'Fix validation to preview'}
          </p>
        </div>
      </form>
    </section>
  );
};

interface CustomQuestionEditorProps {
  readonly disabled: boolean;
  readonly index: number;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly onAddChoiceOption: (questionId: string) => void;
  readonly onMove: (questionId: string, direction: -1 | 1) => void;
  readonly onRemove: (questionId: string) => void;
  readonly onRemoveChoiceOption: (questionId: string, optionId: string) => void;
  readonly onUpdate: (
    questionId: string,
    patch: Partial<CustomQuestionConfig>,
  ) => void;
  readonly onUpdateChoiceOption: (
    questionId: string,
    optionId: string,
    label: string,
  ) => void;
  readonly question: CustomQuestionConfig;
}

const CustomQuestionEditor = ({
  disabled,
  index,
  isFirst,
  isLast,
  onAddChoiceOption,
  onMove,
  onRemove,
  onRemoveChoiceOption,
  onUpdate,
  onUpdateChoiceOption,
  question,
}: CustomQuestionEditorProps) => (
  <section
    aria-label={`Custom question ${index + 1} ${customTypeLabel(question)}`}
    className="rounded-md border border-rooster-line p-4"
  >
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase text-rooster-muted">
          Custom {index + 1} · {customTypeLabel(question)}
        </p>
        <h4 className="mt-1 text-base font-black text-rooster-ink">
          {question.prompt || 'Untitled question'}
        </h4>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || isFirst}
          type="button"
          onClick={() => onMove(question.id, -1)}
        >
          Up
        </button>
        <button
          className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || isLast}
          type="button"
          onClick={() => onMove(question.id, 1)}
        >
          Down
        </button>
        <button
          className="focus-ring min-h-10 rounded-md border border-rooster-red/40 px-3 text-sm font-bold text-rooster-red transition hover:bg-rooster-red/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          type="button"
          onClick={() => onRemove(question.id)}
        >
          Remove
        </button>
      </div>
    </div>

    <div className="mt-4 grid gap-4">
      <label className="grid gap-2 text-sm font-bold text-rooster-ink">
        Question
        <input
          className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 py-2 font-normal"
          disabled={disabled}
          maxLength={180}
          value={question.prompt}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onUpdate(question.id, {
              prompt: event.target.value,
            })
          }
        />
      </label>
      <label className="grid gap-2 text-sm font-bold text-rooster-ink">
        Banter/context
        <input
          className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 py-2 font-normal"
          disabled={disabled}
          maxLength={240}
          value={question.banter ?? ''}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onUpdate(question.id, {
              banter: event.target.value,
            })
          }
        />
      </label>
      <label className="grid gap-2 text-sm font-bold text-rooster-ink">
        Counting definition
        <textarea
          className="focus-ring min-h-24 rounded-md border border-rooster-line px-3 py-2 font-normal"
          disabled={disabled}
          maxLength={500}
          value={question.countingDefinition}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
            onUpdate(question.id, {
              countingDefinition: event.target.value,
            })
          }
        />
      </label>

      {question.answerType === 'number' ? (
        <NumberQuestionFields
          disabled={disabled}
          question={question}
          onUpdate={onUpdate}
        />
      ) : (
        <ChoiceQuestionFields
          disabled={disabled}
          question={question}
          onAddChoiceOption={onAddChoiceOption}
          onRemoveChoiceOption={onRemoveChoiceOption}
          onUpdate={onUpdate}
          onUpdateChoiceOption={onUpdateChoiceOption}
        />
      )}
    </div>
  </section>
);

const NumberQuestionFields = ({
  disabled,
  onUpdate,
  question,
}: {
  readonly disabled: boolean;
  readonly onUpdate: (
    questionId: string,
    patch: Partial<CustomQuestionConfig>,
  ) => void;
  readonly question: CustomNumberQuestionConfig;
}) => (
  <div className="grid gap-3 sm:grid-cols-3">
    <label className="grid gap-2 text-sm font-bold text-rooster-ink">
      Minimum answer
      <input
        className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 py-2 font-normal"
        disabled={disabled}
        inputMode="numeric"
        type="number"
        value={question.min}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onUpdate(question.id, {
            min: parseIntegerInput(event.target.value),
          })
        }
      />
    </label>
    <label className="grid gap-2 text-sm font-bold text-rooster-ink">
      Maximum answer
      <input
        className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 py-2 font-normal"
        disabled={disabled}
        inputMode="numeric"
        type="number"
        value={question.max}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onUpdate(question.id, {
            max: parseIntegerInput(event.target.value),
          })
        }
      />
    </label>
    <label className="grid gap-2 text-sm font-bold text-rooster-ink">
      Deduction per unit
      <input
        className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 py-2 font-normal"
        disabled={disabled}
        inputMode="numeric"
        min={1}
        type="number"
        value={question.deductionPerUnit}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onUpdate(question.id, {
            deductionPerUnit: parseIntegerInput(event.target.value),
          })
        }
      />
    </label>
  </div>
);

const ChoiceQuestionFields = ({
  disabled,
  onAddChoiceOption,
  onRemoveChoiceOption,
  onUpdate,
  onUpdateChoiceOption,
  question,
}: {
  readonly disabled: boolean;
  readonly onAddChoiceOption: (questionId: string) => void;
  readonly onRemoveChoiceOption: (questionId: string, optionId: string) => void;
  readonly onUpdate: (
    questionId: string,
    patch: Partial<CustomQuestionConfig>,
  ) => void;
  readonly onUpdateChoiceOption: (
    questionId: string,
    optionId: string,
    label: string,
  ) => void;
  readonly question: CustomChoiceQuestionConfig;
}) => (
  <div className="grid gap-4">
    <label className="grid max-w-xs gap-2 text-sm font-bold text-rooster-ink">
      Incorrect deduction
      <input
        className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 py-2 font-normal"
        disabled={disabled}
        inputMode="numeric"
        min={1}
        type="number"
        value={question.incorrectDeduction}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onUpdate(question.id, {
            incorrectDeduction: parseIntegerInput(event.target.value),
          })
        }
      />
    </label>
    <div className="grid gap-3">
      {question.options.map((option, optionIndex) => (
        <div
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
          key={option.id}
        >
          <label className="grid gap-2 text-sm font-bold text-rooster-ink">
            Choice {optionIndex + 1}
            <input
              className="focus-ring min-h-10 rounded-md border border-rooster-line px-3 py-2 font-normal"
              disabled={disabled}
              maxLength={80}
              value={option.label}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onUpdateChoiceOption(question.id, option.id, event.target.value)
              }
            />
          </label>
          <button
            className="focus-ring self-end rounded-md border border-rooster-line px-3 py-2 text-sm font-bold text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            type="button"
            onClick={() => onRemoveChoiceOption(question.id, option.id)}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
    <button
      className="focus-ring min-h-10 justify-self-start rounded-md border border-rooster-line px-3 text-sm font-bold text-rooster-ink transition hover:bg-rooster-paper disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      type="button"
      onClick={() => onAddChoiceOption(question.id)}
    >
      Add choice
    </button>
  </div>
);

export const fallbackQuestionConfigSession = (): QuestionConfigSession => ({
  config: emptyConfig(),
  expectedRevision: 1,
  fixtureId: '',
  fixtureLabel: 'Fixture',
});
