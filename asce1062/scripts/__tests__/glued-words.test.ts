import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { findGluedWords } from "../lib/glued-words.mjs";

const glued = (body: string) =>
	findGluedWords(new JSDOM(`<!doctype html><html><body>${body}</body></html>`).window.document);

describe("findGluedWords", () => {
	it("flags a letter touching the start of an inline element", () => {
		expect(glued("<p>read<em>more</em> here</p>")).toEqual([
			{ tag: "em", side: "before", snippet: "read<em>more</em> here" },
		]);
	});

	it("flags a letter touching the end of an inline element", () => {
		expect(glued('<p>see <a href="/x">the blog</a>today</p>')).toEqual([
			{ tag: "a", side: "after", snippet: "see <a>the blog</a>today" },
		]);
	});

	it("flags a boundary between two adjacent inline elements", () => {
		const found = glued("<p><strong>bold</strong><em>italic</em></p>");
		expect(found.map((f) => [f.tag, f.side])).toEqual([
			["strong", "after"],
			["em", "before"],
		]);
	});

	it("passes whitespace, punctuation and footnote refs", () => {
		const html =
			'<p>Read the <a href="/blog">blog</a>, see <em>now</em>. A claim<sup><a href="#fn1">1</a></sup> stands.</p>';
		expect(glued(html)).toEqual([]);
	});

	it("passes English suffixes on code identifiers", () => {
		expect(glued("<p>Two <code>Promise</code>s, <code>fetch</code>ing and <code>map</code>ed.</p>")).toEqual([]);
	});

	it("still flags code followed by a whole word", () => {
		expect(glued("<p>call <code>fetch</code>now</p>")).toHaveLength(1);
		expect(glued("<p>see<code>fetch</code> here</p>")).toHaveLength(1);
	});

	it("passes code spans inside code-like text", () => {
		expect(glued("<p>replace .default(sql<code>CURRENT_TIMESTAMP</code>) with it</p>")).toEqual([]);
		expect(glued("<p>call <code>Intl</code>DateTimeFormat.format() here</p>")).toEqual([]);
	});

	it("passes children of flex and grid containers", () => {
		const html =
			'<nav style="display:flex"><a href="/a">alpha</a><a href="/b">beta</a></nav>' +
			'<ul style="display:grid"><code>React</code><code>Astro</code></ul>';
		expect(glued(html)).toEqual([]);
	});

	it("passes neighbours that are block-level, hidden or out of flow", () => {
		const html =
			'<div><a href="/a">Title</a><p>Description</p></div>' +
			"<p><strong>Status</strong><small hidden>Copied</small></p>" +
			'<p><em>Saved</em><small style="position:absolute">Toast</small></p>';
		expect(glued(html)).toEqual([]);
	});

	it("looks past hidden siblings to the text that shares the line", () => {
		expect(glued("<p>foo<span hidden>x</span><em>bar</em></p>")).toHaveLength(1);
	});

	it("ignores spans, pre blocks and aria-hidden content", () => {
		const html =
			'<p><span>let</span><span>ters</span></p><pre><code>a<b>b</b>c</code></pre><p aria-hidden="true">x<em>y</em></p>';
		expect(glued(html)).toEqual([]);
	});

	it("treats non-Latin letters as letters", () => {
		expect(glued("<p>caf<em>é</em>s</p>")).toHaveLength(2);
	});
});
