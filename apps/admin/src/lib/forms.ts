export function splitCommaSeparated(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function splitKeyValueLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex < 0) {
        return null;
      }

      const key = line.slice(0, separatorIndex).trim();
      const text = line.slice(separatorIndex + 1).trim();
      if (!key || !text) {
        return null;
      }

      return { key, text };
    })
    .filter((entry): entry is { key: string; text: string } => entry !== null);
}

export function splitExampleLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const separatorIndex = line.indexOf('|');
      if (separatorIndex < 0) {
        return null;
      }

      const fr = line.slice(0, separatorIndex).trim();
      const ru = line.slice(separatorIndex + 1).trim();
      if (!fr || !ru) {
        return null;
      }

      return { fr, ru };
    })
    .filter((entry): entry is { fr: string; ru: string } => entry !== null);
}

export function formatDateTime(value: string | undefined) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString('ru-RU');
}
