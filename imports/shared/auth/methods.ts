export const AUTH_METHODS = {
  requestAdminSignInLink: 'auth.requestAdminSignInLink',
  requestSignInLink: 'auth.requestSignInLink',
  invalidateSameAccountSignInLink: 'auth.invalidateSameAccountSignInLink',
  currentAccess: 'auth.currentAccess',
} as const;

export const ADMIN_METHODS = {
  accessSummary: 'admin.accessSummary',
} as const;

export const TEST_AUTH_METHODS = {
  createVerifiedUser: 'test.auth.createVerifiedUser',
  environment: 'test.auth.environment',
  latestMailFor: 'test.mail.latestFor',
  loginTokenForEmail: 'test.auth.loginTokenForEmail',
  reset: 'test.auth.reset',
  setAdminForEmail: 'test.auth.setAdminForEmail',
} as const;

export interface RequestSignInLinkInput {
  readonly email: string;
  readonly returnTo?: string;
}

export interface RequestSignInLinkResult {
  readonly acknowledged: true;
  readonly expiresInMinutes: number;
}

export interface InvalidateSameAccountSignInLinkInput {
  readonly email: string;
  readonly token: string;
}

export interface InvalidateSameAccountSignInLinkResult {
  readonly invalidated: true;
}

export interface CurrentAccessResult {
  readonly email: string | null;
  readonly isAuthenticated: boolean;
  readonly isPlatformAdmin: boolean;
  readonly isVerified: boolean;
  readonly userId: string | null;
}

export interface AdminAccessSummary {
  readonly generatedAt: string;
  readonly packageVersions: {
    readonly accountsBase: string;
    readonly accountsPasswordless: string;
    readonly ddpRateLimiter: string;
    readonly email: string;
  };
  readonly totals: {
    readonly users: number;
    readonly verifiedEmailUsers: number;
  };
}
