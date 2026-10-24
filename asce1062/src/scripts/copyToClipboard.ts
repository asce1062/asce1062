/**
 * Copy to clipboard utilities.
 *
 * `writeTextToClipboard` is the shared low-level browser primitive. UI surfaces
 * decide how to acknowledge success (the terminal prints inline command output).
 */

export async function writeTextToClipboard(text: string): Promise<boolean> {
	if (!navigator.clipboard?.writeText) return false;

	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
