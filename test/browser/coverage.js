// Line coverage for the page's own scripts, from the V8 coverage Chromium
// records through Playwright. V8 reports byte ranges and how often each ran;
// a line counts as covered when its first character ran at least once.
// Blank lines, comments and lines that only close a block are left out.
// That is lenient with one-line conditionals (`if (x) return;` counts once
// the `if` runs), so `strict` also gives the share of code characters that
// ran, outside comments, which does see the untaken `return`. Both are
// approximations, meant for spotting whole paths nobody exercises.

export function lineCoverage(entries, suffix) {
  const hits = entries.filter((e) => new URL(e.url).pathname.endsWith(suffix));
  if (!hits.length) return null;
  const { source } = hits[0];
  const ran = new Uint8Array(source.length);
  for (const entry of hits) {
    const count = new Int32Array(source.length).fill(-1);
    // Within a function V8 lists the outer range first, then the blocks
    // inside it, so later ranges override earlier ones.
    for (const fn of entry.functions) {
      for (const r of fn.ranges) count.fill(r.count, r.startOffset, r.endOffset);
    }
    for (let i = 0; i < source.length; i++) if (count[i] > 0) ran[i] = 1;
  }
  // Code characters: not whitespace, not inside a // comment.
  let code = 0;
  let codeRan = 0;
  for (const m of source.matchAll(/\/\/[^\n]*|\S/g)) {
    if (m[0].length > 1) continue; // a comment
    code++;
    if (ran[m.index]) codeRan++;
  }
  let total = 0;
  let hit = 0;
  const missed = [];
  let offset = 0;
  source.split('\n').forEach((line, i) => {
    const first = line.search(/\S/);
    if (first >= 0 && !/^\s*(\/\/|[}\])]+[;,)]*\s*$)/.test(line)) {
      total++;
      if (ran[offset + first]) hit++;
      else missed.push(i + 1);
    }
    offset += line.length + 1;
  });
  return { total, hit, percent: (100 * hit) / total, missed, strict: (100 * codeRan) / code };
}
