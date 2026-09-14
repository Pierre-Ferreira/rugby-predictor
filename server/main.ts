import { Meteor } from 'meteor/meteor';

Meteor.startup(() => {
  console.info(
    'Rugby Rooster server started. No application publications or methods are exposed in CCPP-001.',
  );
});
