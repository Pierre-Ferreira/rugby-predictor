import { Meteor } from 'meteor/meteor';
import '/imports/server/auth/server';
import '/imports/server/fixtures/server';
import '/imports/server/matchResults/server';
import '/imports/server/playerFixtureScores/server';
import '/imports/server/predictions/server';
import '/imports/server/pwa/server';

Meteor.startup(() => {
  console.info(
    'Rugby Rooster server started with passwordless accounts, fixtures, predictions, and fixture score projections.',
  );
});
