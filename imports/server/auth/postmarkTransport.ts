import { Email } from 'meteor/email';

import {
  sendPostmarkEmail,
  type EmailDeliveryOptions,
} from '/imports/shared/auth/postmark';
import type { ResolvedPostmarkEmailSettings } from '/imports/shared/auth/config';

interface EmailPackageWithCustomTransport {
  customTransport: (options: EmailDeliveryOptions) => Promise<void>;
}

export const configurePostmarkMailTransport = (
  settings: ResolvedPostmarkEmailSettings,
) => {
  (Email as unknown as EmailPackageWithCustomTransport).customTransport =
    async (options) => {
      await sendPostmarkEmail({
        fetchImpl: fetch,
        options,
        settings,
      });
    };
};
