import { Meteor } from 'meteor/meteor';

export const callMeteorMethod = <TResult>(
  name: string,
  ...args: readonly unknown[]
): Promise<TResult> =>
  new Promise((resolve, reject) => {
    Meteor.call(
      name,
      ...args,
      (error: Meteor.Error | undefined, result: unknown) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result as TResult);
      },
    );
  });
