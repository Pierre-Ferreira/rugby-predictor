import type {
  KaplayMatchResultRuntimeFactoryInput,
  MatchResultRuntimeSnapshot,
} from './matchResultRuntime';

export interface KaplayPreviewAttemptController {
  readonly deadlineAt: number;
  readonly id: number;
  readonly fail: (error: Error) => void;
  readonly isCurrent: () => boolean;
  readonly remainingTimeMs: () => number;
  readonly startRuntime: (
    input: KaplayMatchResultRuntimeFactoryInput,
  ) => () => void;
  readonly updateSnapshot: (snapshot: MatchResultRuntimeSnapshot) => void;
}
