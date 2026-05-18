import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = "scripts/hash-admin-token.mjs";
const VALID_TOKEN = "a".repeat(32);

function runInteractive(input: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		const child = spawn("node", [SCRIPT_PATH], { stdio: ["pipe", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString("utf8");
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString("utf8");
		});
		child.on("close", (code) => resolve({ code, stdout, stderr }));

		child.stdin.end(input);
	});
}

describe("hash-admin-token script", () => {
	it("generates a raw token and prints only an Argon2id hash to stdout", async () => {
		const { stdout, stderr } = await execFileAsync("node", [SCRIPT_PATH, "--generate"]);

		const rawTokenMatch = stderr.match(/Raw admin token: ([a-f0-9]{64})/);
		expect(rawTokenMatch?.[1]).toHaveLength(64);
		expect(stderr).toContain("Save this raw token in a password manager.");
		expect(stdout.trim()).toMatch(/^\$argon2id\$/);
		expect(stdout).not.toContain(rawTokenMatch?.[1] ?? "");
	});

	it("generates a raw token when interactive input is left empty", async () => {
		const result = await runInteractive("\n");

		const rawTokenMatch = result.stderr.match(/Raw admin token: ([a-f0-9]{64})/);
		expect(result.code).toBe(0);
		expect(rawTokenMatch?.[1]).toHaveLength(64);
		expect(result.stderr).toContain("Save this raw token in a password manager.");
		expect(result.stdout.trim()).toMatch(/^\$argon2id\$/);
		expect(result.stdout).not.toContain(rawTokenMatch?.[1] ?? "");
	});

	it("prints only an Argon2id hash in argument mode", async () => {
		const { stdout, stderr } = await execFileAsync("node", [SCRIPT_PATH, VALID_TOKEN]);

		expect(stderr).toBe("");
		expect(stdout.trim()).toMatch(/^\$argon2id\$/);
		expect(stdout).not.toContain(VALID_TOKEN);
	});

	it("rejects a short token without echoing it", async () => {
		await expect(execFileAsync("node", [SCRIPT_PATH, "short"])).rejects.toMatchObject({
			code: 1,
			stderr: expect.stringContaining("at least 32 characters"),
		});
	});

	it("exits non-zero when interactive confirmation does not match", async () => {
		const result = await runInteractive(`${VALID_TOKEN}\n${"b".repeat(32)}\n`);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain("do not match");
		expect(result.stdout).toBe("");
	});
});
