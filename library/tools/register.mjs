#!/usr/bin/env node
// §6 moves validated drafts into the library and rebuilds index.json.
//   register.mjs <sample-id>                     register every passing draft of the sample
//   register.mjs --approve <part-id> --by <name> human approval for icons/palette (§5)
import fs from 'node:fs';
import path from 'node:path';
import {
  HUMAN_APPROVAL_AXES, parseArgs, isSample, loadDrafts, loadRegistered, idToRel, p, writeJSON,
  setStatus, sampleDir, today, die, companion,
} from './lib.mjs';
import { validatePart } from './validate.mjs';
import { buildIndex } from './build-index.mjs';

const args = parseArgs(process.argv.slice(2));

function pendingApprovals(sample) {
  return loadRegistered().filter((x) => x.data.source_sample === sample && HUMAN_APPROVAL_AXES.includes(x.data.axis) && !x.data.approved);
}

function draftsLeft(sample) {
  return loadDrafts(sample).length;
}

function settle(sample) {
  if (!isSample(sample)) return;
  if (draftsLeft(sample)) return console.log(`${sample}: 未登録ドラフトが残っているので status は変えない`);
  const pending = pendingApprovals(sample);
  setStatus(sample, pending.length ? 'awaiting_approval' : 'registered');
  console.log(`${sample}: status ${pending.length ? `awaiting_approval（承認待ち ${pending.length} 件: ${pending.map((x) => x.data.id).join(', ')}）` : 'registered'}`);
}

if (args.approve) {
  const id = args.approve;
  if (!args.by || args.by === true) die('--by <承認者> が必要（例: --by Taka）');
  const part = loadRegistered().find((x) => x.data.id === id);
  if (!part) die(`登録済み部品にない: ${id}`);
  const next = { ...part.data, approved: true, approved_by: args.by, approved_at: today() };
  const { errors } = validatePart({ ...part, data: next }, loadRegistered(), { requirePreview: true });
  if (errors.length) die(`承認できない（検証エラー）:\n  ${errors.join('\n  ')}`);
  writeJSON(part.file, next);
  buildIndex();
  console.log(`approved ${id} by ${args.by}`);
  settle(next.source_sample);
  process.exit(0);
}

const sample = args._[0];
if (!sample || !isSample(sample)) die('usage: register.mjs <sample-id> | register.mjs --approve <part-id> --by <name>');

if (!fs.existsSync(path.join(sampleDir(sample), 'observation.md'))) {
  console.log('! observation.md がない。§10 の完了条件（取り出さなかった軸の理由）を満たせない');
}

const drafts = loadDrafts(sample);
if (!drafts.length) die(`${sample}: drafts/ に部品がない`);
const registered = loadRegistered();
let moved = 0;
for (const part of drafts) {
  const { errors } = validatePart(part, [...registered, ...drafts], { requirePreview: true });
  const id = part.data.id || part.expectedId;
  if (errors.length) {
    console.log(`skip ${id}\n       ✗ ${errors.join('\n       ✗ ')}`);
    continue;
  }
  const dest = p(`${idToRel(id)}.json`);
  const data = { ...part.data, approved: !HUMAN_APPROVAL_AXES.includes(part.data.axis) };
  writeJSON(dest, data);
  for (const ext of ['.svg', '.html']) {
    const c = companion(part, ext);
    if (fs.existsSync(c)) fs.renameSync(c, dest.replace(/\.json$/, ext));
  }
  fs.rmSync(part.file);
  registered.push({ ...part, file: dest, data });
  moved++;
  console.log(`reg  ${id}${data.approved ? '' : '  （承認待ち: Taka にプレビューを見せて --approve）'}`);
}

// Remove empty draft folders so a finished sample reads as finished.
function prune(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory() && e.name !== '_raw-svg') prune(path.join(dir, e.name));
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}
prune(path.join(sampleDir(sample), 'drafts'));

const idx = buildIndex();
console.log(`registered ${moved}/${drafts.length}; index.json: ${idx.total} parts ${JSON.stringify(idx.counts)}`);
settle(sample);
process.exit(moved === drafts.length ? 0 : 1);
