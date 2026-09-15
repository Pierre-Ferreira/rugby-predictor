const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailIdentityValidation {
  readonly email: string;
  readonly isValid: boolean;
  readonly reason?: string;
}

export const normalizeEmailIdentity = (value: string): string =>
  value.trim().toLowerCase();

export const validateEmailIdentity = (
  value: unknown,
): EmailIdentityValidation => {
  if (typeof value !== 'string') {
    return {
      email: '',
      isValid: false,
      reason: 'Enter an email address.',
    };
  }

  const email = normalizeEmailIdentity(value);

  if (!email) {
    return {
      email,
      isValid: false,
      reason: 'Enter an email address.',
    };
  }

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return {
      email,
      isValid: false,
      reason: 'Enter a valid email address.',
    };
  }

  return {
    email,
    isValid: true,
  };
};

export const assertValidEmailIdentity = (value: unknown): string => {
  const validation = validateEmailIdentity(value);

  if (!validation.isValid) {
    throw new Error(validation.reason ?? 'Invalid email address.');
  }

  return validation.email;
};
