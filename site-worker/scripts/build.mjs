import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const assets = {
  html: fs.readFileSync(path.join(root, "index.html"), "utf8"),
  css: fs.readFileSync(path.join(root, "style.css"), "utf8"),
  js: fs.readFileSync(path.join(root, "script.js"), "utf8"),
  prompt: fs.readFileSync(path.join(root, "prompt.example.txt"), "utf8"),
};
const source = fs.readFileSync(path.join(root, "worker", "index.js"), "utf8");
const dist = path.join(root, "dist");
fs.mkdirSync(path.join(dist, "server"), { recursive: true });
fs.mkdirSync(path.join(dist, ".openai"), { recursive: true });
fs.writeFileSync(path.join(dist, "server", "index.js"), `const ASSETS = ${JSON.stringify(assets)};\n${source}`);
fs.copyFileSync(path.join(root, ".openai", "hosting.json"), path.join(dist, ".openai", "hosting.json"));
