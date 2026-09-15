import { MongoInternals } from 'meteor/mongo';

import {
  type MongoConnectionEndpoint,
  type ObservedMongoConnectionIdentity,
} from '/imports/shared/auth/testDatabaseIdentity';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const parseEndpointPort = (value: string): number | null => {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const port = Number(value);

  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
};

const parseTopologyAddress = (
  address: unknown,
): MongoConnectionEndpoint | null => {
  if (typeof address !== 'string') {
    return null;
  }

  const trimmed = address.trim();
  const ipv6Match = /^\[([^\]]+)\]:(\d+)$/.exec(trimmed);

  if (ipv6Match) {
    const port = parseEndpointPort(ipv6Match[2]);

    return port ? { host: ipv6Match[1], port } : null;
  }

  const parts = trimmed.split(':');

  if (parts.length !== 2 || !parts[0]) {
    return null;
  }

  const port = parseEndpointPort(parts[1]);

  return port ? { host: parts[0], port } : null;
};

const readDatabaseName = (db: unknown): string | null => {
  if (!isRecord(db)) {
    return null;
  }

  const state = isRecord(db.s) ? db.s : null;
  const namespace = state && isRecord(state.namespace) ? state.namespace : null;

  return (
    stringValue(db.databaseName) ??
    stringValue(state?.databaseName) ??
    stringValue(namespace?.db)
  );
};

const readTopologyDescription = (
  client: unknown,
): Record<string, unknown> | null => {
  if (!isRecord(client)) {
    return null;
  }

  const topology = isRecord(client.topology) ? client.topology : null;
  const topologyState =
    topology && isRecord(topology.s) ? topology.s : null;

  return topology && isRecord(topology.description)
    ? topology.description
    : topologyState && isRecord(topologyState.description)
      ? topologyState.description
      : null;
};

const readActiveTopologyEndpoints = (
  description: Record<string, unknown> | null,
): readonly MongoConnectionEndpoint[] | null => {
  const servers = description?.servers;

  if (!(servers instanceof Map)) {
    return null;
  }

  const endpoints = Array.from(servers.values()).map((server) =>
    isRecord(server) ? parseTopologyAddress(server.address) : null,
  );

  return endpoints.every(Boolean)
    ? (endpoints as readonly MongoConnectionEndpoint[])
    : null;
};

const readClientOptions = (client: unknown): Record<string, unknown> | null => {
  if (!isRecord(client)) {
    return null;
  }

  return isRecord(client.options) ? client.options : null;
};

const classifyTopology = ({
  client,
  description,
  endpoints,
}: {
  readonly client: unknown;
  readonly description: Record<string, unknown> | null;
  readonly endpoints: readonly MongoConnectionEndpoint[] | null;
}): ObservedMongoConnectionIdentity['topology'] => {
  const options = readClientOptions(client);

  if (options?.loadBalanced === true) {
    return 'load-balanced';
  }

  if (typeof options?.srvHost === 'string') {
    return 'srv';
  }

  if (endpoints && endpoints.length > 1) {
    return 'multiple';
  }

  if (description?.type === 'Single') {
    return 'single';
  }

  return 'unknown';
};

export const getActiveMongoConnectionIdentity =
  async (): Promise<ObservedMongoConnectionIdentity | null> => {
    const driver =
      MongoInternals.defaultRemoteCollectionDriver() as unknown as {
        mongo?: {
          client?: unknown;
          db?: {
            client?: unknown;
            command?: (command: { readonly ping: 1 }) => Promise<unknown>;
          };
        };
      };
    const mongo = driver.mongo;
    const db = mongo?.db;
    const client = mongo?.client ?? db?.client;

    if (!db || !client || typeof db.command !== 'function') {
      return null;
    }

    await db.command({ ping: 1 });

    const description = readTopologyDescription(client);
    const endpoints = readActiveTopologyEndpoints(description);

    return {
      databaseName: readDatabaseName(db),
      endpoints,
      topology: classifyTopology({
        client,
        description,
        endpoints,
      }),
    };
  };
