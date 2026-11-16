const REASON_TEXT_PATTERN = /^[\p{L}\p{N} .,!?'"():;\/-]+$/u;

export function normalizeReasonText(value: string): string {
  return value.trim();
}

export function getReasonTextError(value: string, label: string): string | null {
  const normalized = normalizeReasonText(value);

  if (normalized.length < 3) {
    return `${label} must be at least 3 characters.`;
  }
  if (normalized.length > 250) {
    return `${label} must be no more than 250 characters.`;
  }
  if (!REASON_TEXT_PATTERN.test(normalized)) {
    return `${label} may contain only letters, numbers, spaces, and basic punctuation.`;
  }

  return null;
}
