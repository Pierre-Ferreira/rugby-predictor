const lockQueues = new Map<string, Promise<void>>();

export const withProcessLock = async <T>(
  key: string,
  operation: () => Promise<T>,
): Promise<T> => {
  const previous = lockQueues.get(key) ?? Promise.resolve();
  let releaseCurrentLock: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    releaseCurrentLock = resolve;
  });
  const tail = previous.then(() => current);

  lockQueues.set(key, tail);

  await previous;

  try {
    return await operation();
  } finally {
    releaseCurrentLock();

    if (lockQueues.get(key) === tail) {
      lockQueues.delete(key);
    }
  }
};
