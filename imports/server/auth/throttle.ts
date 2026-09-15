import { Meteor } from 'meteor/meteor';

import {
  type ResolvedThrottleRule,
  resolveAuthThrottleLimits,
} from '/imports/shared/auth/config';
import { getRugbyRoosterSettings } from './settings';

export const AUTH_THROTTLE_LIMITS = resolveAuthThrottleLimits(
  getRugbyRoosterSettings(),
);

interface ThrottleBucket {
  readonly timestamps: number[];
  readonly windowMs: number;
}

const buckets = new Map<string, ThrottleBucket>();

const pruneExpiredThrottleBuckets = (now: number) => {
  for (const [key, bucket] of buckets.entries()) {
    const oldestAllowed = now - bucket.windowMs;
    const timestamps = bucket.timestamps.filter(
      (timestamp) => timestamp > oldestAllowed,
    );

    if (timestamps.length === 0) {
      buckets.delete(key);
      continue;
    }

    buckets.set(key, {
      timestamps,
      windowMs: bucket.windowMs,
    });
  }
};

export const resetAuthThrottlesForTests = () => {
  buckets.clear();
};

export const getAuthThrottleBucketCountForTests = () => buckets.size;

export const getThrottleIdentityForInvocation = (
  invocation: Pick<Meteor.MethodThisType, 'connection'>,
): string => {
  const connection = invocation.connection;
  const address = connection?.clientAddress;

  if (address) {
    return `ip:${address}`;
  }

  if (connection?.id) {
    return `connection:${connection.id}`;
  }

  return 'unknown-connection';
};

export const checkAuthThrottle = (
  rule: ResolvedThrottleRule,
  identity: string,
  now = Date.now(),
) => {
  pruneExpiredThrottleBuckets(now);

  const key = `${rule.keyPrefix}:${identity}`;
  const oldestAllowed = now - rule.windowMs;
  const timestamps = (buckets.get(key)?.timestamps ?? []).filter(
    (timestamp) => timestamp > oldestAllowed,
  );

  if (timestamps.length >= rule.limit) {
    const retryAt = timestamps[0] + rule.windowMs;
    const retrySeconds = Math.max(1, Math.ceil((retryAt - now) / 1000));

    buckets.set(key, {
      timestamps,
      windowMs: rule.windowMs,
    });

    throw new Meteor.Error(
      'too-many-requests',
      `Too many attempts. Please wait ${retrySeconds} seconds before trying again.`,
    );
  }

  timestamps.push(now);
  buckets.set(key, {
    timestamps,
    windowMs: rule.windowMs,
  });
};
