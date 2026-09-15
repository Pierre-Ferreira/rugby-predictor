import { Meteor } from 'meteor/meteor';

import {
  configureAccounts,
  configureEmailDelivery,
  configurePasswordlessEmails,
  protectPasswordlessPackageMethods,
} from './accounts';
import { provisionPlatformAdminFromSettings } from './authorization';
import { registerAuthMethods } from './methods';
import { registerAuthTestMethods } from './testSupport';
import { validateRugbyRoosterAuthConfiguration } from './settings';

validateRugbyRoosterAuthConfiguration();
configureAccounts();
configureEmailDelivery();
configurePasswordlessEmails();
protectPasswordlessPackageMethods();
registerAuthMethods();
registerAuthTestMethods();

Meteor.startup(async () => {
  await provisionPlatformAdminFromSettings();
});
