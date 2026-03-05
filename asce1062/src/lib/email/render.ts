/**
 * Thin wrapper around Astro's container API for rendering .astro email template
 * components to an HTML string at runtime.
 *
 * A single AstroContainer instance is created lazily and reused across renders.
 * renderToString() is stateless per-call so sharing the container is safe and
 * avoids redundant initialization when notify + copy emails are sent together.
 */
import { experimental_AstroContainer } from "astro/container";
import { HTML_SIZE_WARN_BYTES } from "@/config/email-config";

type AstroComponent = Parameters<Awaited<ReturnType<typeof experimental_AstroContainer.create>>["renderToString"]>[0];

// Module-level singleton. Created once, reused for every render call.
let containerPromise: ReturnType<typeof experimental_AstroContainer.create> | undefined;

function getContainer() {
	containerPromise ??= experimental_AstroContainer.create();
	return containerPromise;
}

export async function renderEmailHtml(Component: AstroComponent, props: Record<string, unknown>): Promise<string> {
	const container = await getContainer();
	// partial: true . Return the component's own HTML without Astro's outer shell
	const html = await container.renderToString(Component, { props, partial: true });
	if (html.length > HTML_SIZE_WARN_BYTES) {
		// Log size only .Never log props, subject, or content
		console.warn(
			`[email:render] HTML payload is ${html.length} bytes (>${HTML_SIZE_WARN_BYTES / 1_000}KB). Truncate content in the template`
		);
	}
	return html;
}
