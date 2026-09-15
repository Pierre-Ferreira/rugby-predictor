const FALLBACK_RETURN_PATH = '/games';
const MAX_RETURN_PATH_LENGTH = 500;
const SAFE_QUERY_VALUE_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;

const isFixturePath = (pathname: string): boolean =>
  /^\/fixtures(?:\/[a-zA-Z0-9_-]{1,80})?$/.test(pathname);

const isAllowedPath = (pathname: string): boolean =>
  pathname === '/' ||
  pathname === '/games' ||
  pathname === '/account' ||
  pathname === '/admin' ||
  isFixturePath(pathname);

const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);

    return code < 32 || code === 127;
  });

const appendPermittedQueryParameters = (
  pathname: string,
  source: URLSearchParams,
  target: URLSearchParams,
) => {
  if (!isFixturePath(pathname)) {
    return;
  }

  const tab = source.get('tab');
  if (
    tab &&
    ['summary', 'predictions', 'leaderboard'].includes(tab) &&
    SAFE_QUERY_VALUE_PATTERN.test(tab)
  ) {
    target.set('tab', tab);
  }
};

export const resolveSafeReturnPath = (value: unknown): string => {
  if (typeof value !== 'string') {
    return FALLBACK_RETURN_PATH;
  }

  const candidate = value.trim();

  if (
    !candidate ||
    candidate.length > MAX_RETURN_PATH_LENGTH ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    hasControlCharacter(candidate)
  ) {
    return FALLBACK_RETURN_PATH;
  }

  let parsed: URL;

  try {
    parsed = new URL(candidate, 'https://rugby-rooster.local');
  } catch {
    return FALLBACK_RETURN_PATH;
  }

  if (
    parsed.origin !== 'https://rugby-rooster.local' ||
    !isAllowedPath(parsed.pathname)
  ) {
    return FALLBACK_RETURN_PATH;
  }

  const permittedParams = new URLSearchParams();
  appendPermittedQueryParameters(
    parsed.pathname,
    parsed.searchParams,
    permittedParams,
  );

  const query = permittedParams.toString();
  return `${parsed.pathname}${query ? `?${query}` : ''}`;
};

export const authReturnToQuery = (returnTo: string): string =>
  `returnTo=${encodeURIComponent(resolveSafeReturnPath(returnTo))}`;

export const signInPathForReturnTo = (returnTo: string): string =>
  `/sign-in?${authReturnToQuery(returnTo)}`;

export const adminSignInPathForReturnTo = (returnTo: string): string =>
  `/sign-in?mode=admin&${authReturnToQuery(returnTo)}`;

export { FALLBACK_RETURN_PATH };
