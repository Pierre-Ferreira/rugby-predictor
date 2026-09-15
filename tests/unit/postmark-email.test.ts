import { describe, expect, it } from 'vitest';

import {
  buildPostmarkEmailPayload,
  sendPostmarkEmail,
  type EmailDeliveryOptions,
  type PostmarkFetch,
} from '../../imports/shared/auth/postmark';
import type { ResolvedPostmarkEmailSettings } from '../../imports/shared/auth/config';

const postmarkSettings: ResolvedPostmarkEmailSettings = {
  apiToken: 'server-token-secret',
  from: 'pierre@tektite.biz',
  supportEmail: 'support@tektite.biz',
};

describe('Postmark email adapter', () => {
  it('maps delivery options to the Postmark single-email payload', () => {
    expect(
      buildPostmarkEmailPayload(
        {
          html: '<p>Open the Rugby Rooster link.</p>',
          subject: 'Your Rugby Rooster sign-in link',
          text: 'Open the Rugby Rooster link.',
          to: 'player@example.test',
        },
        postmarkSettings,
      ),
    ).toEqual({
      From: 'pierre@tektite.biz',
      HtmlBody: '<p>Open the Rugby Rooster link.</p>',
      MessageStream: 'outbound',
      ReplyTo: 'support@tektite.biz',
      Subject: 'Your Rugby Rooster sign-in link',
      TextBody: 'Open the Rugby Rooster link.',
      To: 'player@example.test',
    });
  });

  it('sends the intended recipient, sender, subject, text, and HTML content', async () => {
    const calls: {
      readonly body: string;
      readonly headers: Record<string, string>;
      readonly input: string;
    }[] = [];
    const fetchImpl: PostmarkFetch = async (input, init) => {
      calls.push({
        body: init.body,
        headers: init.headers,
        input,
      });

      return {
        ok: true,
        status: 200,
      };
    };

    await sendPostmarkEmail({
      fetchImpl,
      options: {
        from: 'pierre@tektite.biz',
        html: '<p>Continue signing in.</p>',
        replyTo: 'pierre@tektite.biz',
        subject: 'Your Rugby Rooster sign-in link',
        text: 'Continue signing in.',
        to: ['player@example.test'],
      },
      settings: postmarkSettings,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe('https://api.postmarkapp.com/email');
    expect(calls[0]?.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': postmarkSettings.apiToken,
    });
    expect(JSON.parse(calls[0]?.body ?? '')).toEqual({
      From: 'pierre@tektite.biz',
      HtmlBody: '<p>Continue signing in.</p>',
      MessageStream: 'outbound',
      ReplyTo: 'pierre@tektite.biz',
      Subject: 'Your Rugby Rooster sign-in link',
      TextBody: 'Continue signing in.',
      To: 'player@example.test',
    });
  });

  it('rejects invalid delivery options before invoking the provider', async () => {
    let callCount = 0;
    const fetchImpl: PostmarkFetch = async () => {
      callCount += 1;

      return {
        ok: true,
        status: 200,
      };
    };

    await expect(
      sendPostmarkEmail({
        fetchImpl,
        options: {
          subject: 'Missing recipient',
          text: 'No recipient here.',
        },
        settings: postmarkSettings,
      }),
    ).rejects.toThrow(/requires a recipient/);
    expect(callCount).toBe(0);
  });

  it('propagates provider failure without leaking credentials or raw body', async () => {
    const rawProviderBody =
      'provider body mentions server-token-secret and a complete login URL';
    const options: EmailDeliveryOptions = {
      html: '<a href="http://127.0.0.1:3000/auth/email-link?token=SECRET">link</a>',
      subject: 'Your Rugby Rooster sign-in link',
      text: 'http://127.0.0.1:3000/auth/email-link?token=SECRET',
      to: 'player@example.test',
    };
    const fetchImpl: PostmarkFetch = async () => ({
      ok: false,
      status: 422,
    });

    await expect(
      sendPostmarkEmail({
        fetchImpl,
        options,
        settings: postmarkSettings,
      }),
    ).rejects.toThrow(/^Postmark email delivery failed with status 422\.$/);

    try {
      await sendPostmarkEmail({
        fetchImpl,
        options,
        settings: postmarkSettings,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;

      expect(message).not.toContain(postmarkSettings.apiToken);
      expect(message).not.toContain(rawProviderBody);
      expect(message).not.toContain('token=SECRET');
    }
  });
});
