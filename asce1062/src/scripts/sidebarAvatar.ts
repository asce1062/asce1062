/**
 * Sidebar Avatar Widget
 *
 * Binds the sidebar AvatarMiniWidget to the avatarStore.
 * Cross-tab and same-page sync are handled entirely by avatarStore + avatarMiniWidget.
 * Saving to localStorage is done via the save button inside the mini widget itself.
 */

import { bindAvatarMiniWidget } from "@/scripts/avatarMiniWidget";

let _widgetAc: AbortController | null = null;

function init(): void {
	_widgetAc?.abort();
	_widgetAc = bindAvatarMiniWidget("sidebar");
}

document.addEventListener("astro:page-load", init);
