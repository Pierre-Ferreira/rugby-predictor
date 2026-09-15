import { defineConfig } from '@meteorjs/rspack';
import { DefinePlugin } from '@rspack/core';
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin';

/**
 * Rspack configuration for Meteor projects.
 *
 * Provides typed flags on the `Meteor` object, such as:
 * - `Meteor.isClient` / `Meteor.isServer`
 * - `Meteor.isDevelopment` / `Meteor.isProduction`
 * - …and other flags available
 *
 * Use these flags to adjust your build settings based on environment.
 */
export default defineConfig((Meteor) => {
  const isIsolatedE2eRun =
    process.env.RUGBY_ROOSTER_TEST_MODE === 'isolated' &&
    process.env.RUGBY_ROOSTER_TEST_RUN_ID?.startsWith('rr-e2e-') === true;
  const shouldDisableClientHmr =
    Meteor.isClient && Meteor.isDevelopment && isIsolatedE2eRun;

  return {
    ...(Meteor.isClient && Meteor.isDevelopment
      ? {
          devServer: {
            allowedHosts: ['localhost', '127.0.0.1'],
            host: 'localhost',
            ...(shouldDisableClientHmr
              ? {
                  hot: false,
                  liveReload: false,
                }
              : {}),
          },
        }
      : {}),
    plugins: [
      ...(shouldDisableClientHmr
        ? [
            new DefinePlugin({
              'Meteor.isTest': JSON.stringify(true),
            }),
          ]
        : []),
      new TsCheckerRspackPlugin({
        typescript: { tsgo: true },
      }),
    ],
  };
});
