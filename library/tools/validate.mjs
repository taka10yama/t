#!/usr/bin/env node
// §5 automatic checks. Usage: validate.mjs [<sample-id> | <part-id> | --all] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  AXES, HUMAN_APPROVAL_AXES, parseArgs, vocab, isSample, loadDrafts, loadRegistered, companion,
  previewPath, contrast, parseColor, parseBezier, die,
} from './lib.mjs';

const COMMON = ['id', 'axis', 'mood', 'fit', 'avoid', 'formats', 'source_sample', 'license', 'approved', 'created_at'];
const AXIS_KEYS = {
  motion: ['kind'],
  type: ['display', 'body', 'scale_ratio', 'autosize', 'max_chars_per_line'],
  layout: ['aspect', 'grid', 'padding', 'align', 'wireframe'],
  icons: ['colors', 'motifs'],
  palette: ['rule', 'min_contrast_ink', 'examples'],
  pacing: ['scene_sec', 'motion_ratio', 'hold_ratio'],
};
const MOTION_KINDS = ['enter', 'exit', 'emphasis', 'stagger'];
const ASPECTS = ['16:9', '9:16', '1:1', '4:5'];
const BAD_LICENSE = /^(|不明|unknown|none|なし|n\/a|tbd|\?)$/i;

// ---------- per-axis checks ----------
function checkMotion(d, err) {
  if (!MOTION_KINDS.includes(d.kind)) err(`kind は ${MOTION_KINDS.join('/')} のいずれか`);
  if (d.kind === 'stagger') {
    if (!Array.isArray(d.step_ms) || d.step_ms.length < 2) return err('stagger には step_ms（2要素以上）が必要');
    if (!Array.isArray(d.applies_to) || d.applies_to.length !== d.step_ms.length) err('applies_to は step_ms と同じ長さ');
    if (d.step_ms[0] !== 0) err('step_ms[0] は 0');
    d.step_ms.slice(1).forEach((s, i) => {
      if (!(s >= 50 && s <= 200)) err(`step_ms[${i + 1}]=${s} は 50〜200ms の範囲外`);
    });
    return;
  }
  for (const k of ['curve', 'duration_ms']) if (d[k] === undefined) err(`必須キー ${k} がない`);
  if (d.curve !== undefined && !parseBezier(d.curve) && !['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'].includes(d.curve)) {
    err(`curve "${d.curve}" は cubic-bezier(...) かCSSキーワード`);
  }
  const b = parseBezier(d.curve);
  if (b && (b[0] < 0 || b[0] > 1 || b[2] < 0 || b[2] > 1)) err('cubic-bezier の x1/x2 は 0〜1');
  if (!(d.duration_ms >= 150 && d.duration_ms <= 900)) err(`duration_ms=${d.duration_ms} は 150〜900ms の範囲外`);
  if (d.delay_ms !== undefined && !(d.delay_ms >= 0)) err('delay_ms は 0 以上');
  if (d.kind === 'enter' && d.transform_from === undefined && d.opacity_from === undefined && d.clip_from === undefined) err('enter には transform_from / opacity_from / clip_from のどれかが必要');
  if (d.kind === 'exit' && d.transform_to === undefined && d.opacity_to === undefined) err('exit には transform_to か opacity_to が必要');
}

function checkType(d, err) {
  for (const role of ['display', 'body']) {
    const r = d[role];
    if (!r || typeof r !== 'object') { err(`${role} がオブジェクトでない`); continue; }
    for (const k of ['family', 'weight', 'tracking_em', 'leading']) if (r[k] === undefined) err(`${role}.${k} がない`);
    if (r.tracking_em !== undefined && Math.abs(r.tracking_em) > 0.3) err(`${role}.tracking_em=${r.tracking_em} が極端`);
  }
  if (!(d.scale_ratio > 1)) err('scale_ratio は 1 より大きい');
  if (!d.autosize || typeof d.autosize !== 'object' || !Object.keys(d.autosize).length) err('autosize が空');
}

function checkLayout(d, err, part) {
  if (!Array.isArray(d.aspect) || !d.aspect.length) err('aspect は配列');
  else {
    d.aspect.forEach((a) => ASPECTS.includes(a) || err(`aspect "${a}" は ${ASPECTS.join('/')} のいずれか`));
    if (d.aspect.includes('16:9') && d.aspect.includes('9:16')) err('16:9 と 9:16 は別部品にする');
  }
  if (!Array.isArray(d.padding) || d.padding.length !== 4) err('padding は [上,右,下,左] の4要素');
  if (!['left', 'center', 'right'].includes(d.align)) err('align は left/center/right');
  const html = companion(part, '.html');
  if (!fs.existsSync(html)) return err(`骨組みHTML ${path.basename(html)} がない`);
  const src = fs.readFileSync(html, 'utf8');
  if (/<(img|svg|image|video)\b/i.test(src)) err('骨組みHTMLに図像（img/svg/video）を入れない');
  if (/url\(/i.test(src)) err('骨組みHTMLに外部画像（url()）を入れない');
}

function svgColors(src) {
  const vars = new Set([...src.matchAll(/var\(--(c\d)\)/g)].map((m) => m[1]));
  const raw = [...src.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-z]+)/g)]
    .map((m) => m[1].toLowerCase())
    .filter((c) => !['none', 'transparent', 'currentcolor', 'inherit', 'var'].includes(c));
  return { vars, raw };
}

export function svgPathSignature(src) {
  return [...src.matchAll(/\sd\s*=\s*"([^"]+)"/g)].map((m) => m[1].replace(/\s+/g, ' ').trim()).sort().join('|');
}

function checkIcon(d, err, part) {
  const svgFile = companion(part, '.svg');
  if (!fs.existsSync(svgFile)) return err(`SVG ${path.basename(svgFile)} がない`);
  const src = fs.readFileSync(svgFile, 'utf8');
  const vb = src.match(/viewBox\s*=\s*"([^"]+)"/);
  if (!vb || vb[1].trim().split(/[\s,]+/).map(Number).join(' ') !== '0 0 200 200') err('viewBox は "0 0 200 200"');
  if (/<image\b/i.test(src)) err('<image> を含む');
  if (/<(linear|radial)Gradient\b/i.test(src)) err('グラデーションを含む');
  if (/<filter\b|\bfilter\s*[:=]/i.test(src)) err('filter（影・ぼかし）を含む');
  if (/<(script|foreignObject)\b/i.test(src)) err('<script>/<foreignObject> を含む');
  if (/\bstroke\s*[:=]\s*["']?(?!none)/i.test(src) && !/stroke-linecap\s*[:=]\s*["']?round/i.test(src)) {
    err('stroke を使うなら stroke-linecap="round"');
  }
  const { vars, raw } = svgColors(src);
  if (raw.length) err(`色は var(--c1..c5) に置換する（生の色: ${[...new Set(raw)].join(', ')}）`);
  const bad = [...vars].filter((v) => !/^c[1-5]$/.test(v));
  if (bad.length) err(`使える変数は --c1〜--c5（${bad.join(', ')}）`);
  if (vars.size < 3 || vars.size > 5) err(`色数 ${vars.size} は 3〜5 の範囲外`);
  if (d.colors !== vars.size) err(`colors=${d.colors} と SVG 内の色数 ${vars.size} が一致しない`);
  if (!Array.isArray(d.motifs) || !d.motifs.length) err('motifs が空');
  if (!/^icons\.[a-z0-9-]+\.[a-z0-9-]+$/.test(d.id || '')) err('icons の id は icons.<category>.<slug>');
}

function checkPalette(d, err) {
  const roles = d.roles || ['bg', 'ink', 'acc', 'disc'];
  const bi = roles.indexOf('bg');
  const ii = roles.indexOf('ink');
  if (bi < 0 || ii < 0) err('roles に bg と ink が必要');
  if (!(d.min_contrast_ink >= 4.5)) err('min_contrast_ink は 4.5 以上（WCAG AA）');
  if (!Array.isArray(d.examples) || !d.examples.length) return err('examples が空');
  d.examples.forEach((ex, n) => {
    if (!Array.isArray(ex) || ex.length !== roles.length) return err(`examples[${n}] は roles（${roles.join(',')}）と同じ長さ`);
    ex.forEach((c) => parseColor(c) || err(`examples[${n}] の "${c}" が色として読めない`));
    if (bi < 0 || ii < 0 || !parseColor(ex[bi]) || !parseColor(ex[ii])) return;
    const r = contrast(ex[bi], ex[ii]);
    if (r < d.min_contrast_ink) err(`examples[${n}] ink/bg のコントラスト ${r.toFixed(2)} < ${d.min_contrast_ink}`);
    const ai = roles.indexOf('acc');
    if (d.min_contrast_acc !== undefined && ai >= 0 && parseColor(ex[ai])) {
      const ra = contrast(ex[bi], ex[ai]);
      if (ra < d.min_contrast_acc) err(`examples[${n}] acc/bg のコントラスト ${ra.toFixed(2)} < ${d.min_contrast_acc}`);
    }
  });
}

function checkPacing(d, err) {
  if (!(d.scene_sec > 0 && d.scene_sec <= 60)) err('scene_sec は 0〜60 秒');
  if (!(d.motion_ratio >= 0 && d.hold_ratio >= 0)) err('ratio は 0 以上');
  if (Math.abs(d.motion_ratio + d.hold_ratio - 1) > 0.011) err(`motion_ratio + hold_ratio = ${(d.motion_ratio + d.hold_ratio).toFixed(2)} が 1 でない`);
}

const CHECKS = { motion: checkMotion, type: checkType, layout: checkLayout, icons: checkIcon, palette: checkPalette, pacing: checkPacing };

// ---------- duplicates (§5 重複) ----------
function near(a, b, tol) { return Math.abs(a - b) < tol; }

function isDuplicate(a, b, partA, partB) {
  if (a.axis !== b.axis) return false;
  switch (a.axis) {
    case 'motion': {
      if (a.kind !== b.kind) return false;
      if (a.kind === 'stagger') return JSON.stringify(a.step_ms) === JSON.stringify(b.step_ms);
      const [x, y] = [parseBezier(a.curve), parseBezier(b.curve)];
      const sameCurve = x && y ? x.every((v, i) => near(v, y[i], 0.05)) : a.curve === b.curve;
      return sameCurve && near(a.duration_ms, b.duration_ms, 50)
        && (a.transform_from || a.transform_to) === (b.transform_from || b.transform_to)
        && (a.clip_from || a.clip_to) === (b.clip_from || b.clip_to);
    }
    case 'type':
      return ['display', 'body'].every((r) => a[r]?.family === b[r]?.family && a[r]?.weight === b[r]?.weight
        && near(a[r]?.tracking_em ?? 0, b[r]?.tracking_em ?? 0, 0.01) && near(a[r]?.leading ?? 0, b[r]?.leading ?? 0, 0.05));
    case 'layout':
      return a.grid === b.grid && JSON.stringify(a.aspect) === JSON.stringify(b.aspect)
        && JSON.stringify(a.padding) === JSON.stringify(b.padding) && a.align === b.align;
    case 'icons': {
      const [fa, fb] = [companion(partA, '.svg'), companion(partB, '.svg')];
      if (!fs.existsSync(fa) || !fs.existsSync(fb)) return false;
      const sa = svgPathSignature(fs.readFileSync(fa, 'utf8'));
      return sa !== '' && sa === svgPathSignature(fs.readFileSync(fb, 'utf8'));
    }
    case 'palette':
      return a.rule.trim() === b.rule.trim() || JSON.stringify(a.examples) === JSON.stringify(b.examples);
    case 'pacing':
      return near(a.scene_sec, b.scene_sec, 0.2) && near(a.motion_ratio, b.motion_ratio, 0.03);
    default: return false;
  }
}

// ---------- entry ----------
// others: registered parts (+ sibling drafts) to compare against for duplicates.
export function validatePart(part, others = [], { requirePreview = false } = {}) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const d = part.data;
  if (d.__parseError) return { errors: [`JSON が壊れている: ${d.__parseError}`], warnings };

  const v = vocab();
  for (const k of COMMON) if (d[k] === undefined) err(`共通メタデータ ${k} がない`);
  if (d.id && d.id !== part.expectedId) err(`id "${d.id}" とファイル位置（${part.expectedId}）が一致しない`);
  if (d.axis && !AXES.includes(d.axis)) err(`axis "${d.axis}" が不正`);
  if (d.id && d.axis && !d.id.startsWith(`${d.axis}.`)) err('id は axis で始める');
  for (const k of ['mood', 'fit', 'avoid']) {
    if (d[k] === undefined) continue;
    if (!Array.isArray(d[k])) { err(`${k} は配列`); continue; }
    const unknown = d[k].filter((w) => !v[k].includes(w));
    if (unknown.length) err(`${k} に語彙表にない語: ${unknown.join(', ')}（先に vocab.json に追加する）`);
  }
  if (Array.isArray(d.mood) && !d.mood.length) err('mood が空');
  if (Array.isArray(d.fit) && !d.fit.length) err('fit が空');
  if (Array.isArray(d.fit) && Array.isArray(d.avoid)) {
    const clash = d.fit.filter((w) => d.avoid.includes(w));
    if (clash.length) err(`fit と avoid の両方に入っている: ${clash.join(', ')}`);
  }
  if (d.formats !== undefined) {
    if (!Array.isArray(d.formats) || !d.formats.length) err('formats は空でない配列');
    else d.formats.forEach((f) => v.formats.includes(f) || err(`formats "${f}" は ${v.formats.join('/')}`));
  }
  if (d.license !== undefined && BAD_LICENSE.test(String(d.license).trim())) err(`license "${d.license}" は不合格（空・不明は登録不可）`);
  if (d.created_at !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(d.created_at)) err('created_at は YYYY-MM-DD');
  if (d.approved === true && HUMAN_APPROVAL_AXES.includes(d.axis) && !d.approved_by) {
    err(`${d.axis} の approved: true には人間の承認（approved_by）が必要`);
  }
  if (typeof d.approved !== 'boolean' && d.approved !== undefined) err('approved は true/false');

  if (AXIS_KEYS[d.axis]) {
    for (const k of AXIS_KEYS[d.axis]) if (d[k] === undefined) err(`${d.axis} の必須キー ${k} がない`);
    if (AXIS_KEYS[d.axis].every((k) => d[k] !== undefined)) CHECKS[d.axis](d, err, part);
  }

  if (!errors.length) {
    for (const o of others) {
      if (o.file === part.file || o.data.__parseError) continue;
      if (o.data.id === d.id) { err(`id "${d.id}" は既に存在する（${path.relative(process.cwd(), o.file)}）`); continue; }
      if (isDuplicate(d, o.data, part, o)) err(`既存部品 ${o.data.id} とほぼ同じ。新規登録せず既存を使う`);
    }
  }

  if (!fs.existsSync(previewPath(d.id || part.expectedId))) {
    (requirePreview ? errors : warnings).push('プレビュー未作成（preview.mjs を実行）');
  }
  return { errors, warnings };
}

// Resolves a CLI target into { parts, others } for validation.
export function resolveTarget(target) {
  const registered = loadRegistered();
  if (!target || target === '--all') return { label: 'registered', parts: registered, others: registered };
  if (isSample(target)) {
    const drafts = loadDrafts(target);
    return { label: `drafts of ${target}`, parts: drafts, others: [...registered, ...drafts], sample: target };
  }
  const part = registered.find((x) => x.data.id === target);
  if (!part) die(`見つからない: ${target}（inbox のサンプルIDか登録済みの部品ID）`);
  return { label: target, parts: [part], others: registered };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { label, parts, others } = resolveTarget(args.all ? '--all' : args._[0]);
  const results = parts.map((part) => ({ id: part.data.id || part.expectedId, file: part.file, ...validatePart(part, others) }));
  const failed = results.filter((r) => r.errors.length);

  if (args.json) console.log(JSON.stringify(results, null, 2));
  else {
    console.log(`validate: ${label} — ${results.length} parts, ${results.length - failed.length} pass, ${failed.length} fail`);
    for (const r of results) {
      console.log(`${r.errors.length ? 'FAIL' : 'ok  '} ${r.id}`);
      r.errors.forEach((e) => console.log(`       ✗ ${e}`));
      r.warnings.forEach((w) => console.log(`       ! ${w}`));
    }
  }
  process.exit(failed.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
