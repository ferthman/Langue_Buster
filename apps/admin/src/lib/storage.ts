const SESSION_TOKEN_KEY = 'langue-buster.sessionToken';

export function getStoredSessionToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setStoredSessionToken(token: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearStoredSessionToken() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(SESSION_TOKEN_KEY);
}
