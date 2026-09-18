import type { Meteor } from 'meteor/meteor';

import type { PredictionSessionRendererState } from './predictionSession';
import type { AnimationPreference } from './presentationPreference';

export type PredictionPresentationMode =
  'kaplay' | 'kaplay-loading' | 'standard';

export type PredictionPresentationReason =
  | 'preview-disabled'
  | 'preference-off'
  | 'reduced-motion'
  | 'read-only'
  | 'runtime-failed'
  | 'runtime-loading'
  | 'runtime-ready'
  | 'unsupported-step';

export type KaplayRuntimeStatus = 'failed' | 'idle' | 'loading' | 'ready';

export interface KaplayPreviewSettings {
  readonly enabled: boolean;
  readonly testControls: boolean;
}

export interface KaplayPreviewSettingsInput {
  readonly public?: {
    readonly rugbyRooster?: {
      readonly kaplayPredictionPreview?: {
        readonly enabled?: unknown;
        readonly testControls?: unknown;
      };
    };
  };
}

export interface KaplayPreviewEnvironment {
  readonly isProduction: boolean;
  readonly settings: KaplayPreviewSettingsInput | undefined;
}

export interface PredictionPresentationProjectionInput {
  readonly preference: AnimationPreference;
  readonly previewEnabled: boolean;
  readonly reducedMotion: boolean;
  readonly runtimeStatus: KaplayRuntimeStatus;
  readonly state: PredictionSessionRendererState;
}

export interface PredictionPresentationProjection {
  readonly mode: PredictionPresentationMode;
  readonly reason: PredictionPresentationReason;
  readonly supportsKaplayStep: boolean;
  readonly shouldAttemptKaplay: boolean;
}

export const kaplayMatchResultStepId = 'match-result';

export const resolveKaplayPreviewSettings = ({
  isProduction,
  settings,
}: KaplayPreviewEnvironment): KaplayPreviewSettings => {
  const previewSettings =
    settings?.public?.rugbyRooster?.kaplayPredictionPreview;
  const enabled = previewSettings?.enabled === true && !isProduction;

  return {
    enabled,
    testControls:
      enabled && previewSettings?.testControls === true && !isProduction,
  };
};

export const kaplayPreviewSettingsFromMeteor = (
  meteor: typeof Meteor,
): KaplayPreviewSettings =>
  resolveKaplayPreviewSettings({
    isProduction: meteor.isProduction,
    settings: meteor.settings as KaplayPreviewSettingsInput | undefined,
  });

export const supportsKaplayPredictionStep = (
  state: PredictionSessionRendererState,
): boolean =>
  !state.isReadOnly &&
  state.location.kind === 'step' &&
  state.currentStep?.step.id === kaplayMatchResultStepId;

export const projectPredictionPresentation = ({
  preference,
  previewEnabled,
  reducedMotion,
  runtimeStatus,
  state,
}: PredictionPresentationProjectionInput): PredictionPresentationProjection => {
  const supportsKaplayStep = supportsKaplayPredictionStep(state);

  if (!previewEnabled) {
    return {
      mode: 'standard',
      reason: 'preview-disabled',
      shouldAttemptKaplay: false,
      supportsKaplayStep,
    };
  }

  if (preference === 'off') {
    return {
      mode: 'standard',
      reason: 'preference-off',
      shouldAttemptKaplay: false,
      supportsKaplayStep,
    };
  }

  if (reducedMotion) {
    return {
      mode: 'standard',
      reason: 'reduced-motion',
      shouldAttemptKaplay: false,
      supportsKaplayStep,
    };
  }

  if (state.isReadOnly) {
    return {
      mode: 'standard',
      reason: 'read-only',
      shouldAttemptKaplay: false,
      supportsKaplayStep,
    };
  }

  if (!supportsKaplayStep) {
    return {
      mode: 'standard',
      reason: 'unsupported-step',
      shouldAttemptKaplay: false,
      supportsKaplayStep,
    };
  }

  if (runtimeStatus === 'failed') {
    return {
      mode: 'standard',
      reason: 'runtime-failed',
      shouldAttemptKaplay: false,
      supportsKaplayStep,
    };
  }

  if (runtimeStatus === 'ready') {
    return {
      mode: 'kaplay',
      reason: 'runtime-ready',
      shouldAttemptKaplay: true,
      supportsKaplayStep,
    };
  }

  return {
    mode: 'kaplay-loading',
    reason: 'runtime-loading',
    shouldAttemptKaplay: true,
    supportsKaplayStep,
  };
};
