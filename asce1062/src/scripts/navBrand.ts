/**
 * Navbrand — Visitor-Aware Shell Prompt
 *
 * Three behavioral layers:
 *   Layer 1 (arrival)   — milestone greeting on new page visits
 *   Layer 2 (tod)       — time-of-day greeting on soft nav + tab resume
 *   Layer 3 (sub-line)  — visit N · felt-duration, shown from visit 2+
 *
 * "New visit" detection: sessionStorage marker absent → fresh browser session.
 * "Soft navigation": astro:page-load when marker is already set.
 *
 * Storage:
 *   localStorage  nav-brand-visits     — visit count (integer string)
 *   localStorage  nav-brand-last-visit — last visit Unix ms (string)
 *   sessionStorage nav-brand-visited   — ephemeral session marker
 */

import { PREF_KEYS, getPref, setPref } from "@/lib/prefs";

// ── Pure functions (exported for testing) ───────────────────────────────────

export function getMilestoneGreeting(visits: number): string {
	if (visits <= 1) return "hello, stranger";
	if (visits <= 4) return "welcome back";
	if (visits <= 9) return "back again.";
	if (visits <= 24) return "you keep coming back.";
	if (visits <= 49) return "practically a regular";
	return "asce1062 approves.";
}

export function getTimeOfDayGreeting(hour: number): string {
	if (hour >= 5 && hour < 12) return "good morning";
	if (hour >= 12 && hour < 17) return "good afternoon";
	if (hour >= 17 && hour < 21) return "good evening";
	return "still up?";
}

export function getFeltDuration(lastVisitTs: number, now: number): string {
	const elapsed = now - lastVisitTs;
	if (elapsed < 3_600_000) return "just here a moment ago";
	if (elapsed < 86_400_000) return "back the same day";
	const days = Math.floor(elapsed / 86_400_000);
	if (days < 7) return `been ${days} day${days > 1 ? "s" : ""}`;
	return "been a while";
}

// ── Storage helpers ──────────────────────────────────────────────────────────

const SESSION_KEY = "nav-brand-visited";

function getVisitCount(): number {
	return parseInt(getPref(PREF_KEYS.navBrandVisits) ?? "0", 10);
}

function getLastVisitTs(): number {
	return parseInt(getPref(PREF_KEYS.navBrandLastVisit) ?? "0", 10);
}

// ── DOM rendering ─────────────────────────────────────────────────────────────

function renderBrand(mode: "arrival" | "tod"): void {
	const greetEl = document.getElementById("nav-brand-greeting");
	const subRow = document.getElementById("nav-brand-sub-row");
	const subEl = document.getElementById("nav-brand-sub");
	if (!greetEl) return;

	const visits = getVisitCount();

	if (mode === "tod") {
		greetEl.textContent = getTimeOfDayGreeting(new Date().getHours());
		greetEl.dataset.mode = "tod";
	} else {
		greetEl.textContent = getMilestoneGreeting(visits);
		delete greetEl.dataset.mode;
	}

	if (visits >= 2 && subRow && subEl) {
		subEl.textContent = `visit ${visits} · ${getFeltDuration(getLastVisitTs(), Date.now())}`;
		subRow.style.maxHeight = "2em";
		subRow.style.opacity = "1";
	} else if (subRow) {
		subRow.style.maxHeight = "0";
		subRow.style.opacity = "0";
	}
}

// ── Visit handlers ────────────────────────────────────────────────────────────

function onNewVisit(): void {
	const newCount = getVisitCount() + 1;
	setPref(PREF_KEYS.navBrandVisits, String(newCount));
	setPref(PREF_KEYS.navBrandLastVisit, String(Date.now()));
	sessionStorage.setItem(SESSION_KEY, "1");
	renderBrand("arrival");
}

function onSoftNav(): void {
	renderBrand("tod");
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

if (typeof document !== "undefined") {
	document.addEventListener("astro:page-load", () => {
		if (!sessionStorage.getItem(SESSION_KEY)) {
			onNewVisit();
		} else {
			onSoftNav();
		}
	});

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") {
			renderBrand("tod");
		}
	});
}
