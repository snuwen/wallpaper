#!/usr/bin/env node
// Generates index.html from index.template.html by embedding
// gradient-engine.js's source inline (see index.template.html for why).
// Run this after editing gradient-engine.js or index.template.html.

const fs = require("fs");
const path = require("path");

const dir = __dirname;
const enginePath = path.join(dir, "gradient-engine.js");
const templatePath = path.join(dir, "index.template.html");
const outPath = path.join(dir, "index.html");

const engineSource = fs.readFileSync(enginePath, "utf8");
const template = fs.readFileSync(templatePath, "utf8");

if (/<\/script/i.test(engineSource)) {
  throw new Error(
    "gradient-engine.js contains a literal '</script' sequence, which would " +
    "break out of the inline <script> block it gets embedded in - rename or " +
    "escape it before running build.js."
  );
}

if (!template.includes("{{ENGINE_SOURCE}}")) {
  throw new Error("index.template.html is missing the {{ENGINE_SOURCE}} placeholder.");
}

const output = template.replace("{{ENGINE_SOURCE}}", () => engineSource);
fs.writeFileSync(outPath, output);
console.log(`Wrote ${path.relative(dir, outPath)} (${output.length} bytes).`);
