/**
 * Generates a random 4-character alphanumeric ID.
 * Probability of collision is low enough for our use case (notes in a vault).
 * Alphanumeric (a-z, 0-9) gives 36^4 = 1,679,616 combinations.
 */
export function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
