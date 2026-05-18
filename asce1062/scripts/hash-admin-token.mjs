#!/usr/bin/env node
import { stdin as input, stderr, stdout } from "node:process";
import readline from "node:readline";
import { hash, Algorithm } from "@node-rs/argon2";

const MIN_TOKEN_LENGTH = 32;

function usage() {
	return [
		"Usage:",
		"  node scripts/hash-admin-token.mjs <raw-token>",
		"  node scripts/hash-admin-token.mjs",
		"",
		"Generates the Argon2id value for ADMIN_TOKEN_HASH.",
		"Save the raw token separately in a password manager; store only the hash in deployment env.",
		"In local .env files, escape each $ as \\$ so Vite does not expand the hash fields.",
	].join("\n");
}

function printError(message) {
	stderr.write(`${message}\n`);
}

function validateToken(token) {
	if (!token) return "Token must not be empty.";
	if (token.length < MIN_TOKEN_LENGTH) return `Token must be at least ${MIN_TOKEN_LENGTH} characters.`;
	return "";
}

function promptHidden(query) {
	return new Promise((resolve) => {
		const rl = readline.createInterface({ input, output: stderr, terminal: Boolean(stderr.isTTY) });
		const previousRawMode = Boolean(input.isTTY && input.isRaw);

		if (input.isTTY) {
			input.setRawMode(true);
		}

		stderr.write(query);
		let value = "";

		const cleanup = () => {
			input.off("data", onData);
			if (input.isTTY) {
				input.setRawMode(previousRawMode);
			}
			rl.close();
		};

		const finish = () => {
			stderr.write("\n");
			cleanup();
			resolve(value);
		};

		const onData = (chunk) => {
			const text = chunk.toString("utf8");
			for (const char of text) {
				if (char === "\u0003") {
					stderr.write("\n");
					cleanup();
					process.exit(130);
				}
				if (char === "\r" || char === "\n") {
					finish();
					return;
				}
				if (char === "\u007f" || char === "\b") {
					value = value.slice(0, -1);
					continue;
				}
				value += char;
			}
		};

		input.on("data", onData);
	});
}

async function readTokenFromInput() {
	stderr.write(`${usage()}\n\n`);

	if (!input.isTTY) {
		const text = await new Promise((resolve, reject) => {
			let value = "";
			input.setEncoding("utf8");
			input.on("data", (chunk) => {
				value += chunk;
			});
			input.on("end", () => resolve(value));
			input.on("error", reject);
		});
		const [token = "", confirmation = ""] = text.split(/\r?\n/);
		if (token !== confirmation) {
			throw new Error("Token values do not match.");
		}
		return token;
	}

	const token = await promptHidden("Raw admin token: ");
	const confirmation = await promptHidden("Confirm raw admin token: ");

	if (token !== confirmation) {
		throw new Error("Token values do not match.");
	}

	return token;
}

async function main() {
	const token = process.argv[2] ?? (await readTokenFromInput());
	const validationError = validateToken(token);

	if (validationError) {
		throw new Error(validationError);
	}

	// This hash is the value for ADMIN_TOKEN_HASH. The raw token is shown only
	// to the operator and must be stored separately in a password manager.
	const tokenHash = await hash(token, { algorithm: Algorithm.Argon2id });
	stdout.write(`${tokenHash}\n`);
}

try {
	await main();
} catch (error) {
	if (error instanceof Error && error.message) {
		printError(error.message);
	} else {
		printError("Failed to generate admin token hash.");
	}
	process.exit(1);
}
