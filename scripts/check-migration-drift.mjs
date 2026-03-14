#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const [baseRef, headRef] = process.argv.slice(2);

if (!baseRef || !headRef || /^0+$/.test(baseRef)) {
	console.log("Skipping migration drift check: missing base/head refs.");
	process.exit(0);
}

const changedFiles = execFileSync("git", ["diff", "--name-only", baseRef, headRef], {
	encoding: "utf8",
})
	.split(/\r?\n/)
	.map((value) => value.trim())
	.filter(Boolean);

const migrationTouched = changedFiles.some((file) => file.startsWith("db/migrations/"));
const watchedFiles = new Set([
	"apps/api/internal/database/bootstrap.go",
	"apps/api/internal/database/models.go",
]);
const schemaRelatedChange = changedFiles.some((file) => watchedFiles.has(file));

if (schemaRelatedChange && !migrationTouched) {
	console.error(
		"Schema-related backend files changed without a matching db/migrations change.",
	);
	process.exit(1);
}

console.log("Migration drift check passed.");
