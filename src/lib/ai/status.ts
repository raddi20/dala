const notes: string[] = [];

export function noteRuntimeWarning(message: string) {
  if (!notes.includes(message)) notes.push(message);
}

export function runtimeWarnings(): string[] {
  return [...notes];
}

export function clearRuntimeWarnings() {
  notes.length = 0;
}
