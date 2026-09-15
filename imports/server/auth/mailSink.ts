import { Email } from 'meteor/email';

import { normalizeEmailIdentity } from '/imports/shared/auth/email';

interface CapturedMail {
  readonly createdAt: Date;
  readonly from?: string;
  readonly html?: string;
  readonly id: string;
  readonly replyTo?: string;
  readonly subject?: string;
  readonly testRunId?: string;
  readonly text?: string;
  readonly to: readonly string[];
  readonly url?: string;
}

interface EmailTransportOptions {
  readonly from?: string;
  readonly html?: string;
  readonly replyTo?: string;
  readonly subject?: string;
  readonly text?: string;
  readonly to?: string | readonly string[];
}

let nextMailId = 0;
let failNextMail = false;
const capturedMail: CapturedMail[] = [];
let currentTestRunId: (() => string | null) | null = null;

const urlPattern = /https?:\/\/[^\s<"]+/;

const normalizeRecipients = (
  recipients: string | readonly string[] | undefined,
): readonly string[] => {
  if (!recipients) {
    return [];
  }

  return (Array.isArray(recipients) ? recipients : [recipients]).map((email) =>
    normalizeEmailIdentity(email),
  );
};

export const configureLocalMailSink = (options?: {
  readonly getTestRunId?: () => string | null;
}) => {
  currentTestRunId = options?.getTestRunId ?? null;

  (
    Email as unknown as {
      customTransport: (options: EmailTransportOptions) => Promise<unknown>;
    }
  ).customTransport = async (options: EmailTransportOptions) => {
    if (failNextMail) {
      failNextMail = false;
      throw new Error('Synthetic mail transport failure');
    }

    const text = options.text;
    const html = options.html;
    const linkSource = `${text ?? ''}\n${html ?? ''}`;
    const [url] = linkSource.match(urlPattern) ?? [];

    capturedMail.push({
      createdAt: new Date(),
      from: options.from,
      html,
      id: `local-mail-${nextMailId}`,
      replyTo: options.replyTo,
      subject: options.subject,
      testRunId: currentTestRunId?.() ?? undefined,
      text,
      to: normalizeRecipients(options.to),
      url,
    });
    nextMailId += 1;

    return {
      messageId: capturedMail.at(-1)?.id,
    };
  };
};

export const latestCapturedMailFor = (
  email: string,
  testRunId?: string,
): CapturedMail | undefined => {
  const normalizedEmail = normalizeEmailIdentity(email);

  return capturedMail
    .filter(
      (message) =>
        message.to.includes(normalizedEmail) &&
        (!testRunId || message.testRunId === testRunId),
    )
    .at(-1);
};

export const resetLocalMailSinkForTests = (testRunId?: string) => {
  if (testRunId) {
    const retainedMail = capturedMail.filter(
      (message) => message.testRunId !== testRunId,
    );
    capturedMail.length = 0;
    capturedMail.push(...retainedMail);
  } else {
    capturedMail.length = 0;
  }

  failNextMail = false;
  nextMailId = 0;
};

export const failNextLocalMailForTests = () => {
  failNextMail = true;
};
