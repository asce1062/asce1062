/**
 * Content Collections Configuration
 * Defines schema validation using Zod for type-safe content
 */

import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Base Content Schema
 */
const contentSchema = z.object({
	// Required fields
	title: z.string().min(1, "Title is required").max(100, "Title must be 100 characters or less"),

	description: z
		.string()
		.min(10, "Description must be at least 10 characters")
		.max(200, "Description must be 200 characters or less"),

	pubDate: z.date().refine((date) => date <= new Date(), {
		message: "Publication date cannot be in the future",
	}),

	tags: z
		.array(z.string().min(1, "Tag cannot be empty").toLowerCase())
		.min(1, "At least one tag is required")
		.max(10, "Maximum 10 tags allowed")
		.refine((tags) => new Set(tags).size === tags.length, {
			message: "Tags must be unique",
		}),

	permalink: z.string().min(1, "Permalink is required"),

	// Optional fields
	updatedDate: z
		.date()
		.refine((date) => date <= new Date(), {
			message: "Updated date cannot be in the future",
		})
		.optional(),

	draft: z.boolean().optional().default(false),
});

/**
 * Blog Collection Schema
 */
const blogSchema = contentSchema.extend({
	image: z.object({
		url: z
			.string()
			.min(1, "Image URL is required")
			.refine((url) => url.startsWith("/"), {
				message: "Image URL must be relative to the site root",
			}),
		alt: z
			.string()
			.min(5, "Image alt text must be at least 5 characters")
			.max(150, "Image alt text must be 150 characters or less"),
	}),

	featured: z.boolean().optional().default(false),
});

/**
 * Blog Collection Definition
 */
const blogCollection = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/blog" }),
	schema: blogSchema,
});

/**
 * Notes Collection Schema
 */
const notesSchema = contentSchema;

/**
 * Notes Collection Definition
 */
const notesCollection = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/notes" }),
	schema: notesSchema,
});

/**
 * Export all collections
 */
export const collections = {
	blog: blogCollection,
	notes: notesCollection,
};
