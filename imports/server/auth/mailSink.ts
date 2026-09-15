import { Email } from 'meteor/email';

import { normalizeEmailIdentity } from '/imports/shared/auth/email';

interface CapturedMail {
  readonly createdAt: Date;
  readonly html?: string;
  readonly id: string;
  readonly subject?: string;
  readonly text?: string;
  readonly to: readonly string[];
  readonly url?: string;
}

interface EmailTransportOptions {
  readonly html?: string;
  readonly subject?: string;
  readonly text?: string;
  readonly to?: string | readonly string[];
}

let nextMailId = 0;
let failNextMail = false;
const capturedMail: CapturedMail[] = [];

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

export const configureLocalMailSink = () => {
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
      html,
      id: `local-mail-${nextMailId}`,
      subject: options.subject,
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
): CapturedMail | undefined => {
  const normalizedEmail = normalizeEmailIdentity(email);

  return capturedMail
    .filter((message) => message.to.includes(normalizedEmail))
    .at(-1);
};

export const resetLocalMailSinkForTests = () => {
  capturedMail.length = 0;
  failNextMail = false;
  nextMailId = 0;
};

export const failNextLocalMailForTests = () => {
  failNextMail = true;
};
