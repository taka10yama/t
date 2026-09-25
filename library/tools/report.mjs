#!/usr/bin/env node
// /lib-report: part counts, axis balance, pending approvals, usage top/bottom, inbox progress.
import fs from 'node:fs';
import { AXES, parseArgs, p, readJSON, readJSONL, readIntake, isSample, die } from './lib.mjs';
import { usageCounts } from './pick.mjs';

const args = parseArgs(process.argv.slice(2));
const index = readJSON(p('index.json'), null);
if (!index) die('index.json がない。build-index.mjs を先に実行する');
const log = readJSONL(p('usage-log.jsonl'));
const usage = usageCounts(log);
const parts = index.parts;

const samples = fs.existsSync(p('inbox'))
  ? fs.readdirSync(p('inbox')).filter(isSample).map((id) => ({ id, status: readIntake(id).status || '?' }))
  : [];

const tally = (key) => {
  const c = {};
  for (const x of parts) for (const w of x[key] || []) c[w] = (c[w] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
};
const ranked = [...parts].sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0) || a.id.localeCompare(b.id));
const data = {
  total: parts.length,
  by_axis: Object.fromEntries(AXES.map((a) => [a, {
    total: parts.filter((x) => x.axis === a).length,
    approved: parts.filter((x) => x.axis === a && x.approved).length,
  }])),
  pending_approval: parts.filter((x) => !x.approved).map((x) => x.id),
  missing_preview: parts.filter((x) => !x.preview).map((x) => x.id),
  mood: tally('mood'),
  fit: tally('fit'),
  videos_logged: log.length,
  most_used: ranked.slice(0, 5).map((x) => [x.id, usage[x.id] || 0]),
  least_used: ranked.slice(-5).reverse().map((x) => [x.id, usage[x.id] || 0]),
  inbox: samples,
};

if (args.json) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

const max = Math.max(1, ...Object.values(data.by_axis).map((x) => x.total));
console.log(`# ライブラリ報告（部品 ${data.total} 件 / 使用記録 ${data.videos_logged} 本）\n`);
console.log('## 軸ごとの件数（承認済み/全体）');
for (const [a, x] of Object.entries(data.by_axis)) {
  console.log(`  ${a.padEnd(8)} ${String(x.approved).padStart(3)}/${String(x.total).padEnd(3)} ${'█'.repeat(Math.round((x.total / max) * 30))}`);
}
const empty = AXES.filter((a) => !data.by_axis[a].total);
if (empty.length) console.log(`  ! 空の軸: ${empty.join(', ')}`);
console.log(`\n## 承認待ち（${data.pending_approval.length}）\n  ${data.pending_approval.join('\n  ') || 'なし'}`);
if (data.missing_preview.length) console.log(`\n## プレビューなし（${data.missing_preview.length}）\n  ${data.missing_preview.join('\n  ')}`);
console.log(`\n## mood の偏り\n  ${data.mood.map(([w, n]) => `${w}:${n}`).join('  ') || '-'}`);
console.log(`## fit の偏り\n  ${data.fit.map(([w, n]) => `${w}:${n}`).join('  ') || '-'}`);
if (parts.length) {
  console.log(`\n## 使用頻度 上位\n  ${data.most_used.map(([id, n]) => `${id} (${n})`).join('\n  ')}`);
  console.log(`## 使用頻度 下位\n  ${data.least_used.map(([id, n]) => `${id} (${n})`).join('\n  ')}`);
}
console.log(`\n## inbox（${samples.length}）\n  ${samples.map((s) => `${s.id}: ${s.status}`).join('\n  ') || 'なし'}`);
