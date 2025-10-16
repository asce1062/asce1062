/**
 * Guestbook Counter
 * Generates nostalgic hit counter effect
 */

/**
 * Generate a random counter value (100,000 - 999,999)
 */
export function generateCounterValue(): number {
  return Math.floor(Math.random() * 900000 + 100000);
}

/**
 * Initialize the guestbook counter display
 */
export function initGuestbookCounter(elementId: string = "counter"): void {
  const counter = document.getElementById(elementId);
  if (counter) {
    counter.textContent = generateCounterValue().toString();
  }
}
