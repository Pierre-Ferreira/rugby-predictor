import { Meteor } from 'meteor/meteor';
import '/imports/server/auth/server';
import '/imports/server/pwa/server';

Meteor.startup(() => {
  console.info('Rugby Rooster server started with passwordless accounts.');
});
