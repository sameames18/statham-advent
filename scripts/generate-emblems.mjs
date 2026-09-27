#!/usr/bin/env node

/**
 * Generate the 31 emblem images described in docs/emblem-prompts.md.
 *
 * This uses the OpenAI Images API directly so the repository needs no image
 * generation dependency. Node 22+ provides the fetch implementation used here.
 * Set OPENAI_API_KEY before running it. The default output is public/emblems.
 */

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PROMPTS_FILE = resolve(ROOT, "docs/emblem-prompts.md");
const DEFAULT_OUTPUT_DIR = resolve(ROOT, "public/emblems");
const API_URL = "https://api.openai.com/v1/images/generations";
const DEFAULT_MODEL = "gpt-image-2";
const DEFAULT_SIZE = "1024x1024";
const DEFAULT_QUALITY = "high";
const DEFAULT_CONCURRENCY = 3;

function usage() {
  console.log(`Usage: node scripts/generate-emblems.mjs [options]

Options:
  --out-dir <path>       Output directory (default: public/emblems)
  --model <name>         Image model (default: gpt-image-2)
  --size <WxH>           Image size (default: 1024x1024)
  --quality <level>      low, medium, high, or auto (default: high)
  --concurrency <n>      Number of requests in flight (default: 3)
  --only <slugs>         Comma-separated slugs to generate
  --force                Replace existing files
  --dry-run              Parse and list jobs without calling the API
  --help                 Show this help
`);
}

function parseArgs(argv) {
  const options = {
    outDir: DEFAULT_OUTPUT_DIR,
    model: DEFAULT_MODEL,
    size: DEFAULT_SIZE,
    quality: DEFAULT_QUALITY,
    concurrency: DEFAULT_CONCURRENCY,
    only: null,
    force: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    const [name, inlineValue] = arg.split("=", 2);
    const names = new Map([
      ["--out-dir", "outDir"],
      ["--model", "model"],
      ["--size", "size"],
      ["--quality", "quality"],
      ["--concurrency", "concurrency"],
      ["--only", "only"],
    ]);
    const key = names.get(name);
    if (!key) throw new Error(`Unknown option: ${arg}`);
    const value = inlineValue ?? argv[++i];
    if (!value) throw new Error(`${name} needs a value`);
    options[key] = key === "concurrency" ? Number(value) : value;
  }

  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error("--concurrency must be a positive integer");
  }
  if (!["low", "medium", "high", "auto"].includes(options.quality)) {
    throw new Error("--quality must be low, medium, high, or auto");
  }
  if (!/^\d+x\d+$/.test(options.size)) {
    throw new Error("--size must look like 1024x1024");
  }
  options.outDir = resolve(ROOT, options.outDir);
  options.only = options.only
    ? new Set(options.only.split(",").map((slug) => slug.trim()).filter(Boolean))
    : null;
  return options;
}

function parsePrompts(markdown) {
  const styleSection = markdown.match(
    /## Style block\s+Put this in front of every object prompt, word for word, so each prompt carries the same instructions:\s+((?:>.*(?:\r?\n|$))+)/,
  );
  if (!styleSection) throw new Error("Could not find the style block in emblem-prompts.md");
  const style = styleSection[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/^> ?/, "").trimEnd())
    .filter(Boolean)
    .join("\n");

  const objectSection = markdown.split("## Object prompts")[1]?.split("## Likely refusals")[0];
  if (!objectSection) throw new Error("Could not find the object prompts section");
  const jobs = [...objectSection.matchAll(/^\*\*`([^`]+)`\*\* —[^\r\n]*\r?\n^> ([^\r\n]+)$/gm)]
    .map((match) => ({
      slug: match[1],
      object: match[2].trim(),
      prompt: `${style}\n\n${match[2].trim()}\n\nTransparent background, PNG output. No scenery, text, watermark, or extra objects.`,
    }));

  if (jobs.length !== 31) {
    throw new Error(`Expected 31 object prompts, found ${jobs.length}`);
  }
  return jobs;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function generate(job, options) {
  const output = resolve(options.outDir, `${job.slug}.png`);
  if (!options.force && await exists(output)) {
    return { slug: job.slug, status: "skipped", output };
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      prompt: job.prompt,
      size: options.size,
      quality: options.quality,
      background: "transparent",
      output_format: "png",
      n: 1,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.error?.message || JSON.stringify(body);
    throw new Error(`${job.slug}: API ${response.status}: ${detail}`);
  }
  const encoded = body?.data?.[0]?.b64_json;
  if (!encoded) throw new Error(`${job.slug}: response did not contain image data`);

  await writeFile(output, Buffer.from(encoded, "base64"));
  return { slug: job.slug, status: "generated", output };
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    const markdown = await readFile(PROMPTS_FILE, "utf8");
    let jobs = parsePrompts(markdown);
    if (options.only) {
      const unknown = [...options.only].filter((slug) => !jobs.some((job) => job.slug === slug));
      if (unknown.length) throw new Error(`Unknown slug(s): ${unknown.join(", ")}`);
      jobs = jobs.filter((job) => options.only.has(job.slug));
    }

    console.log(`Loaded ${jobs.length} emblem prompt${jobs.length === 1 ? "" : "s"}.`);
    if (options.dryRun) {
      for (const job of jobs) console.log(`${job.slug} -> ${resolve(options.outDir, `${job.slug}.png`)}`);
      return;
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set; use --dry-run to validate prompts without generating images");
    }

    await mkdir(options.outDir, { recursive: true });
    let next = 0;
    let completed = 0;
    const worker = async () => {
      while (true) {
        const index = next++;
        if (index >= jobs.length) return;
        const result = await generate(jobs[index], options);
        completed += 1;
        console.log(`[${completed}/${jobs.length}] ${result.status}: ${result.slug}`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(options.concurrency, jobs.length) }, worker));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

await main();
