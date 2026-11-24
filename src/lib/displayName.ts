export const DISPLAY_NAME_LIMIT = 20;

export function cleanDisplayName(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, DISPLAY_NAME_LIMIT);
}
