const SESSION_TOKEN_KEY = 'langue-buster.sessionToken';

export function getStoredSessionToken() {
  return readStorage(SESSION_TOKEN_KEY);
}

export function setStoredSessionToken(token: string) {
  writeStorage(SESSION_TOKEN_KEY, token);
}

export function clearStoredSessionToken() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(SESSION_TOKEN_KEY);
}

function readStorage(key: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(key);
}

function writeStorage(key: string, value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, value);
}
