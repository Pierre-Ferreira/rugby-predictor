import { Meteor } from 'meteor/meteor';

const MINUTE_MS = 60 * 1000;

export const AUTH_THROTTLE_LIMITS = {
  linkRequestByEmail: {
    keyPrefix: 'link-email',
    limit: 3,
    windowMs: 15 * MINUTE_MS,
  },
  linkRequestByAddress: {
    keyPrefix: 'link-address',
    limit: 8,
    windowMs: 15 * MINUTE_MS,
  },
  redemptionByEmail: {
    keyPrefix: 'redeem-email',
    limit: 8,
    windowMs: 15 * MINUTE_MS,
  },
  redemptionByAddress: {
    keyPrefix: 'redeem-address',
    limit: 20,
    windowMs: 15 * MINUTE_MS,
  },
} as const;

interface ThrottleRule {
  readonly keyPrefix: string;
  readonly limit: number;
  readonly windowMs: number;
}

const buckets = new Map<string, number[]>();

export const resetAuthThrottlesForTests = () => {
  buckets.clear();
};

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
  rule: ThrottleRule,
  identity: string,
  now = Date.now(),
) => {
  const key = `${rule.keyPrefix}:${identity}`;
  const oldestAllowed = now - rule.windowMs;
  const timestamps = (buckets.get(key) ?? []).filter(
    (timestamp) => timestamp > oldestAllowed,
  );

  if (timestamps.length >= rule.limit) {
    const retryAt = timestamps[0] + rule.windowMs;
    const retrySeconds = Math.max(1, Math.ceil((retryAt - now) / 1000));

    buckets.set(key, timestamps);

    throw new Meteor.Error(
      'too-many-requests',
      `Too many attempts. Please wait ${retrySeconds} seconds before trying again.`,
    );
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
};
