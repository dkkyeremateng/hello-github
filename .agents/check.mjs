// Verification for hello-github. It runs inside the factory's sandbox, which
// has Node and no network, so this check has no dependencies and fetches
// nothing.
//
// It is deliberately about STRUCTURE rather than content: the point is to catch
// an edit that broke the page, not to assert what the page says. A check that
// pinned the wording would fail every time someone legitimately changed it.

import { readFileSync, existsSync } from "node:fs";

const failures = [];

function check(label, condition, detail) {
    if (!condition) failures.push(detail ? `${label}: ${detail}` : label);
}

// --- The files the repository is supposed to have ---

for (const path of ["README.md", "index.html"]) {
    check(path, existsSync(path), "file is missing");
}
if (failures.length) finish();

const html = readFileSync("index.html", "utf8");
check("index.html", html.trim().length > 0, "file is empty");
check("README.md", readFileSync("README.md", "utf8").trim().length > 0, "file is empty");

// --- The landmarks a page needs to render at all ---

for (const tag of ["html", "head", "title", "body"]) {
    check(`<${tag}>`, new RegExp(`<${tag}[\\s>]`, "i").test(html), "element is absent");
}
check("<!DOCTYPE html>", /^\s*<!doctype html>/i.test(html), "declaration is missing or not first");

// --- Tag balance ---
//
// A stack walk over the tags, skipping the void elements that never close and
// the comment/script/style regions where markup rules do not apply. It catches
// the common breakage: an element opened and never closed, or closed in the
// wrong order.

const VOID = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
]);

const stripped = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

const stack = [];
for (const match of stripped.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g)) {
    const [, closing, rawName, attrs] = match;
    const name = rawName.toLowerCase();
    if (VOID.has(name) || attrs.trimEnd().endsWith("/")) continue;

    if (closing) {
        const open = stack.pop();
        if (open !== name) {
            failures.push(`tag balance: </${name}> closes <${open ?? "nothing"}>`);
            break;
        }
    } else {
        stack.push(name);
    }
}
check("tag balance", stack.length === 0, `unclosed ${stack.map((t) => `<${t}>`).join(", ")}`);

finish();

function finish() {
    if (failures.length === 0) {
        console.log("verification: passed");
        process.exit(0);
    }
    for (const f of failures) console.error(`verification: ${f}`);
    process.exit(1);
}
