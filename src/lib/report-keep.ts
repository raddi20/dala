/** Details for a report whose listing was deleted, so the admin still sees what it was about. */
export function deletedListingNote(title: string, details: string): string {
  const note = `[Listing deleted by its owner: "${title}"]`;
  return details.trim() ? `${note}\n${details}` : note;
}
