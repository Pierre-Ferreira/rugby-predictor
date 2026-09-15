import type { ResolvedPostmarkEmailSettings } from './config';

const POSTMARK_EMAIL_ENDPOINT = 'https://api.postmarkapp.com/email';

export interface EmailDeliveryOptions {
  readonly from?: string;
  readonly html?: string;
  readonly replyTo?: string;
  readonly subject?: string;
  readonly text?: string;
  readonly to?: string | readonly string[];
}

export interface PostmarkEmailPayload {
  readonly From: string;
  readonly HtmlBody?: string;
  readonly MessageStream: 'outbound';
  readonly ReplyTo?: string;
  readonly Subject: string;
  readonly TextBody?: string;
  readonly To: string;
}

export interface PostmarkFetchResponse {
  readonly ok: boolean;
  readonly status: number;
}

export type PostmarkFetch = (
  input: string,
  init: {
    readonly body: string;
    readonly headers: Record<string, string>;
    readonly method: 'POST';
  },
) => Promise<PostmarkFetchResponse>;

const cleanOptionalString = (value: string | undefined): string | undefined => {
  const cleanedValue = value?.trim();

  return cleanedValue || undefined;
};

const normalizeRecipients = (
  recipients: string | readonly string[] | undefined,
): string | undefined => {
  if (!recipients) {
    return undefined;
  }

  const values = Array.isArray(recipients) ? recipients : [recipients];
  const normalizedRecipients = values
    .map((recipient) => recipient.trim())
    .filter(Boolean);

  return normalizedRecipients.length > 0
    ? normalizedRecipients.join(', ')
    : undefined;
};

export const buildPostmarkEmailPayload = (
  options: EmailDeliveryOptions,
  settings: ResolvedPostmarkEmailSettings,
): PostmarkEmailPayload => {
  const to = normalizeRecipients(options.to);
  const from = cleanOptionalString(options.from) ?? settings.from;
  const subject = cleanOptionalString(options.subject);
  const text = cleanOptionalString(options.text);
  const html = cleanOptionalString(options.html);
  const replyTo = cleanOptionalString(options.replyTo) ?? settings.supportEmail;

  if (!to) {
    throw new Error('Postmark email delivery requires a recipient.');
  }

  if (!from) {
    throw new Error('Postmark email delivery requires a sender.');
  }

  if (!subject) {
    throw new Error('Postmark email delivery requires a subject.');
  }

  if (!text && !html) {
    throw new Error('Postmark email delivery requires text or HTML content.');
  }

  return {
    From: from,
    HtmlBody: html,
    MessageStream: 'outbound',
    ReplyTo: replyTo,
    Subject: subject,
    TextBody: text,
    To: to,
  };
};

export const sendPostmarkEmail = async ({
  fetchImpl,
  options,
  settings,
}: {
  readonly fetchImpl: PostmarkFetch;
  readonly options: EmailDeliveryOptions;
  readonly settings: ResolvedPostmarkEmailSettings;
}): Promise<void> => {
  const payload = buildPostmarkEmailPayload(options, settings);
  let response: PostmarkFetchResponse;

  try {
    response = await fetchImpl(POSTMARK_EMAIL_ENDPOINT, {
      body: JSON.stringify(payload),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': settings.apiToken,
      },
      method: 'POST',
    });
  } catch {
    throw new Error(
      'Postmark email delivery failed before a response was received.',
    );
  }

  if (!response.ok) {
    throw new Error(
      `Postmark email delivery failed with status ${response.status}.`,
    );
  }
};
