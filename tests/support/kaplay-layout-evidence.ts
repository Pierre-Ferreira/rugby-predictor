import type { Page } from '@playwright/test';

export const readKaplayMatchResultSelectedValue = (
  page: Page,
  {
    timeoutMs,
  }: {
    readonly timeoutMs: number;
  },
): Promise<string | null> =>
  page
    .getByTestId('kaplay-match-result-choice-bridge')
    .evaluate(
      (bridge) =>
        bridge.querySelector<HTMLInputElement>('input:checked')?.value ?? null,
      undefined,
      {
        timeout: timeoutMs,
      },
    );
