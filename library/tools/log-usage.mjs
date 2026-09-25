#!/usr/bin/env node
// §8 appends one usage row. Usage: log-usage.mjs <video_id> <part-id> [<part-id> …] [--force]
//   Fill in results later with: log-usage.mjs --result <video_id> --views_7d 12000 --retention_avg 0.46
import fs from 'node:fs';
import { parseArgs, readJSON, readJSONL, p, die } from './lib.mjs';
import { checkCombo } from './pick.mjs';

const args = parseArgs(process.argv.slice(2));
const file = p('usage-log.jsonl');
const log = readJSONL(file);

if (args.result) {
  const row = log.find((r) => r.video_id === args.result);
  if (!row) die(`usage-log にない: ${args.result}`);
  for (const k of ['views_7d', 'retention_avg']) if (args[k] !== undefined) row.result[k] = Number(args[k]);
  fs.writeFileSync(file, log.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`updated ${args.result}: ${JSON.stringify(row.result)}`);
  process.exit(0);
}

const [videoId, ...parts] = args._;
if (!videoId || !parts.length) die('usage: log-usage.mjs <video_id> <part-id> …');
if (log.some((r) => r.video_id === videoId)) die(`既に記録済み: ${videoId}`);
const index = readJSON(p('index.json'), { parts: [] });
const problems = checkCombo(parts, index.parts, log);
if (problems.length && !args.force) die(`§7 ルール違反（意図的なら --force）:\n  ${problems.join('\n  ')}`);
fs.appendFileSync(file, JSON.stringify({ video_id: videoId, parts, result: { views_7d: null, retention_avg: null } }) + '\n');
console.log(`logged ${videoId} (${parts.length} parts)`);
