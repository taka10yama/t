#!/usr/bin/env node
// §7 candidate search.
//   pick.mjs --mood 力強い[,ポップ] --fit 歴史 --format short [--n 3] [--axis motion,type] [--motif 鉄道] [--json]
//   pick.mjs --check <part-id>,<part-id>,…     only check the §7 combination rules
import { pathToFileURL } from 'node:url';
import { AXES, parseArgs, list, readJSON, readJSONL, p, vocab, die } from './lib.mjs';

const COMBO_AXES = ['motion', 'type', 'layout', 'palette', 'pacing']; // icons are picked per scene by motif
const RECENT = 5;

export function usageCounts(log) {
  const c = {};
  for (const row of log) for (const id of row.parts || []) c[id] = (c[id] || 0) + 1;
  return c;
}

// §7 rules. Returns human-readable violations (empty = OK).
export function checkCombo(ids, parts, log) {
  const byId = Object.fromEntries(parts.map((x) => [x.id, x]));
  const problems = [];
  const missing = ids.filter((id) => !byId[id]);
  if (missing.length) problems.push(`index にない部品: ${missing.join(', ')}`);
  const unapproved = ids.filter((id) => byId[id] && !byId[id].approved);
  if (unapproved.length) problems.push(`未承認の部品: ${unapproved.join(', ')}`);

  const axesBySample = {};
  for (const id of ids) {
    const x = byId[id];
    if (!x?.source_sample) continue;
    (axesBySample[x.source_sample] ||= new Set()).add(x.axis);
  }
  for (const [sample, axes] of Object.entries(axesBySample)) {
    if (axes.size >= 3) problems.push(`同じサンプル ${sample} から ${axes.size} 軸（${[...axes].join('/')}）を使っている。2軸までにする`);
  }

  const triple = (xs) => ['motion', 'type', 'palette'].map((a) => xs.filter((id) => id.startsWith(`${a}.`)).sort().join('+')).join(' | ');
  const mine = triple(ids);
  if (mine.split(' | ').every(Boolean)) {
    const recent = log.slice(-RECENT);
    const hit = recent.find((row) => triple(row.parts || []) === mine);
    if (hit) problems.push(`motion・type・palette の組み合わせが直近${RECENT}本の ${hit.video_id} と完全一致`);
  }
  return problems;
}

function score(part, q, usage) {
  if (!part.approved) return null;
  if (q.format && !(part.formats || []).includes(q.format)) return null;
  if (q.fit.some((f) => (part.avoid || []).includes(f))) return null;
  const moodHit = q.mood.filter((m) => (part.mood || []).includes(m));
  const fitHit = q.fit.filter((f) => (part.fit || []).includes(f));
  const motifHit = q.motif.filter((m) => (part.motifs || []).some((x) => x.includes(m)));
  if (part.axis === 'icons' && q.motif.length && !motifHit.length) return null;
  const s = 2 * moodHit.length + 2 * fitHit.length + 3 * motifHit.length;
  const why = [
    moodHit.length && `mood一致: ${moodHit.join('・')}`,
    fitHit.length && `fit一致: ${fitHit.join('・')}`,
    motifHit.length && `motif一致: ${motifHit.join('・')}`,
    `使用${usage[part.id] || 0}回`,
  ].filter(Boolean).join(' / ');
  return { s, why };
}

export function pick(q, index, log) {
  const usage = usageCounts(log);
  // Motifs live in the part JSON, not the index; merge them in for icon search.
  const parts = index.parts.map((x) => (x.axis === 'icons' ? { ...x, motifs: readJSON(p(x.file)).motifs } : x));
  const result = {};
  for (const axis of q.axes) {
    result[axis] = parts
      .filter((x) => x.axis === axis)
      .map((x) => ({ part: x, r: score(x, q, usage) }))
      .filter((x) => x.r)
      .sort((a, b) => b.r.s - a.r.s || (usage[a.part.id] || 0) - (usage[b.part.id] || 0) || a.part.id.localeCompare(b.part.id))
      .slice(0, q.n)
      .map(({ part, r }) => ({ id: part.id, score: r.s, why: r.why, source_sample: part.source_sample, preview: part.preview }));
  }

  // Best-scoring combination over the candidates that satisfies §7.
  const axes = COMBO_AXES.filter((a) => q.axes.includes(a) && result[a]?.length);
  let best = null;
  const walk = (i, chosen, total) => {
    if (i === axes.length) {
      if (!checkCombo(chosen.map((c) => c.id), parts, log).length && (!best || total > best.total)) best = { total, ids: chosen.map((c) => c.id) };
      return;
    }
    for (const c of result[axes[i]]) walk(i + 1, [...chosen, c], total + c.score);
  };
  if (axes.length) walk(0, [], 0);
  return { candidates: result, combo: best?.ids || null };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const index = readJSON(p('index.json'), null);
  if (!index) die('index.json がない。build-index.mjs を先に実行する');
  const log = readJSONL(p('usage-log.jsonl'));

  if (args.check) {
    const problems = checkCombo(list(args.check), index.parts, log);
    if (args.json) console.log(JSON.stringify({ ok: !problems.length, problems }, null, 2));
    else console.log(problems.length ? problems.map((x) => `✗ ${x}`).join('\n') : 'ok: §7 の組み合わせルールを満たす');
    process.exit(problems.length ? 1 : 0);
  }

  const v = vocab();
  const q = {
    mood: list(args.mood), fit: list(args.fit), motif: list(args.motif),
    format: args.format === true ? undefined : args.format,
    n: Number(args.n) || 3,
    axes: list(args.axis).length ? list(args.axis) : AXES,
  };
  const unknown = [...q.mood.filter((m) => !v.mood.includes(m)), ...q.fit.filter((f) => !v.fit.includes(f))];
  if (unknown.length) console.error(`! 語彙表にない語: ${unknown.join(', ')}（vocab.json を確認）`);
  if (q.format && !v.formats.includes(q.format)) die(`--format は ${v.formats.join('/')}`);

  const out = pick(q, index, log);
  if (args.json) return console.log(JSON.stringify(out, null, 2));
  console.log(`条件: mood=${q.mood.join('・') || '-'} fit=${q.fit.join('・') || '-'} format=${q.format || '-'}${q.motif.length ? ` motif=${q.motif.join('・')}` : ''}`);
  for (const axis of q.axes) {
    const c = out.candidates[axis];
    console.log(`\n[${axis}]${c.length ? '' : ' 候補なし（新規に作り、案件後に inbox へ回す）'}`);
    c.forEach((x, i) => console.log(`  ${i + 1}. ${x.id}  (${x.why})`));
  }
  console.log(`\n推奨の組み合わせ（§7 ルール適合）: ${out.combo ? out.combo.join(', ') : 'なし'}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
