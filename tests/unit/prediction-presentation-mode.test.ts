import { describe, expect, it } from 'vitest';

import {
  projectPredictionPresentation,
  resolveKaplayPreviewSettings,
} from '../../imports/ui/predictions/presentationMode';
import {
  readAnimationPreference,
  readAnimationPreferenceResult,
  writeAnimationPreference,
  type BrowserStorageLike,
} from '../../imports/ui/predictions/presentationPreference';
import type { PredictionSessionRendererState } from '../../imports/ui/predictions/predictionSession';

const rendererState = ({
  isReadOnly = false,
  location = { kind: 'step' as const, stepId: 'match-result' as const },
  stepId = 'match-result',
}: {
  readonly isReadOnly?: boolean;
  readonly location?:
    | { readonly kind: 'intro' }
    | { readonly kind: 'review' }
    | { readonly kind: 'step'; readonly stepId: string };
  readonly stepId?: string;
} = {}): PredictionSessionRendererState =>
  ({
    currentStep:
      location.kind === 'step'
        ? {
            step: {
              id: stepId,
            },
          }
        : null,
    isReadOnly,
    location,
  }) as PredictionSessionRendererState;

describe('prediction presentation mode policy', () => {
  it('makes preview available by default in non-production development', () => {
    expect(
      resolveKaplayPreviewSettings({
        isProduction: false,
        settings: undefined,
      }),
    ).toEqual({
      enabled: true,
      testControls: false,
    });
    expect(
      resolveKaplayPreviewSettings({
        isProduction: false,
        settings: {
          public: {
            rugbyRooster: {
              kaplayPredictionPreview: {
                enabled: false,
                testControls: true,
              },
            },
          },
        },
      }),
    ).toEqual({
      enabled: true,
      testControls: true,
    });
  });

  it('keeps production unavailable and test controls explicitly isolated', () => {
    expect(
      resolveKaplayPreviewSettings({
        isProduction: false,
        settings: {
          public: {
            rugbyRooster: {
              kaplayPredictionPreview: {
                enabled: true,
              },
            },
          },
        },
      }),
    ).toEqual({
      enabled: true,
      testControls: false,
    });
    expect(
      resolveKaplayPreviewSettings({
        isProduction: true,
        settings: {
          public: {
            rugbyRooster: {
              kaplayPredictionPreview: {
                enabled: true,
                testControls: true,
              },
            },
          },
        },
      }),
    ).toEqual({
      enabled: false,
      testControls: false,
    });
  });

  it('does not let a stored On preference override a disabled preview gate', () => {
    expect(
      projectPredictionPresentation({
        preference: 'on',
        previewEnabled: false,
        reducedMotion: false,
        runtimeStatus: 'ready',
        state: rendererState(),
      }),
    ).toMatchObject({
      mode: 'standard',
      reason: 'preview-disabled',
      shouldAttemptKaplay: false,
    });
  });

  it('selects Standard for Off, reduced motion, read-only and unsupported steps', () => {
    expect(
      projectPredictionPresentation({
        preference: 'off',
        previewEnabled: true,
        reducedMotion: false,
        runtimeStatus: 'ready',
        state: rendererState(),
      }).reason,
    ).toBe('preference-off');
    expect(
      projectPredictionPresentation({
        preference: 'on',
        previewEnabled: true,
        reducedMotion: true,
        runtimeStatus: 'ready',
        state: rendererState(),
      }).reason,
    ).toBe('reduced-motion');
    expect(
      projectPredictionPresentation({
        preference: 'on',
        previewEnabled: true,
        reducedMotion: false,
        runtimeStatus: 'ready',
        state: rendererState({ isReadOnly: true }),
      }).reason,
    ).toBe('read-only');
    expect(
      projectPredictionPresentation({
        preference: 'on',
        previewEnabled: true,
        reducedMotion: false,
        runtimeStatus: 'ready',
        state: rendererState({
          location: { kind: 'step', stepId: 'tries' },
          stepId: 'tries',
        }),
      }),
    ).toMatchObject({
      mode: 'standard',
      reason: 'unsupported-step',
      supportsKaplayStep: false,
    });
  });

  it('distinguishes loading, ready and failed runtime states for supported Match Result', () => {
    expect(
      projectPredictionPresentation({
        preference: 'on',
        previewEnabled: true,
        reducedMotion: false,
        runtimeStatus: 'idle',
        state: rendererState(),
      }).mode,
    ).toBe('kaplay-loading');
    expect(
      projectPredictionPresentation({
        preference: 'on',
        previewEnabled: true,
        reducedMotion: false,
        runtimeStatus: 'ready',
        state: rendererState(),
      }).mode,
    ).toBe('kaplay');
    expect(
      projectPredictionPresentation({
        preference: 'on',
        previewEnabled: true,
        reducedMotion: false,
        runtimeStatus: 'failed',
        state: rendererState(),
      }),
    ).toMatchObject({
      mode: 'standard',
      reason: 'runtime-failed',
    });
  });
});

describe('animation preference storage', () => {
  it('defaults malformed, missing and inaccessible values to On', () => {
    expect(readAnimationPreference(undefined)).toBe('on');
    expect(readAnimationPreferenceResult(undefined)).toEqual({
      preference: 'on',
      source: 'default',
    });
    expect(
      readAnimationPreference({
        getItem: () => 'banana',
        setItem: () => undefined,
      }),
    ).toBe('on');
    expect(
      readAnimationPreference({
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => undefined,
      }),
    ).toBe('on');
  });

  it('reads explicit On/Off values and swallows write failures', () => {
    const writes: string[] = [];
    const storage: BrowserStorageLike = {
      getItem: () => 'on',
      setItem: (_key, value) => {
        writes.push(value);
      },
    };

    expect(readAnimationPreference(storage)).toBe('on');
    expect(
      readAnimationPreference({
        getItem: () => 'off',
        setItem: () => undefined,
      }),
    ).toBe('off');
    expect(readAnimationPreferenceResult(storage)).toEqual({
      preference: 'on',
      source: 'stored',
    });
    writeAnimationPreference('off', storage);
    expect(writes).toEqual(['off']);
    expect(() =>
      writeAnimationPreference('on', {
        getItem: () => null,
        setItem: () => {
          throw new Error('blocked');
        },
      }),
    ).not.toThrow();
  });
});
