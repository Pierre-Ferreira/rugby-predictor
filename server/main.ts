import { Meteor } from 'meteor/meteor';
import '/imports/server/auth/server';

Meteor.startup(() => {
  console.info('Rugby Rooster server started with passwordless accounts.');
});
