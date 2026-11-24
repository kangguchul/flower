export function audioContextIsBlocked(state: string) {
  return state === 'suspended' || state === 'interrupted';
}
