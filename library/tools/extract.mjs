#!/usr/bin/env node
// §4③ decomposition helper.
//   extract.mjs <id>                          machine-read source.html -> inbox/<id>/extract-report.json
//   extract.mjs <id> --scaffold <axis> <slug>  draft skeleton with common metadata (approved: false)
//   extract.mjs svgvars <file.svg> [--write]   replace literal colors with var(--c1..) in order of appearance
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, sampleDir, isSample, readIntake, writeJSON, idToRel, today, die, AXES } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const [first, ...rest] = args._;

// ---------- svgvars ----------
const COLOR_RE = /(#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\))/g;

function svgToVars(src) {
  const order = [];
  const out = src.replace(/((?:fill|stroke|stop-color)\s*(?:=\s*["']|:\s*))(#[0-9a-fA-F]{3,6}\b|rgba?\([^)]*\))/g, (m, pre, c) => {
    const key = c.toLowerCase();
    if (!order.includes(key)) order.push(key);
    return `${pre}var(--c${order.indexOf(key) + 1})`;
  });
  return { svg: out, colors: order };
}

if (first === 'svgvars') {
  const file = rest[0];
  if (!file || !fs.existsSync(file)) die('usage: extract.mjs svgvars <file.svg> [--write]');
  const { svg, colors } = svgToVars(fs.readFileSync(file, 'utf8'));
  colors.forEach((c, i) => console.error(`--c${i + 1}: ${c}`));
  if (colors.length > 5) console.error(`! 色が ${colors.length} 色ある。5色以下に減らしてから登録する`);
  if (args.write) fs.writeFileSync(file, svg);
  else process.stdout.write(svg);
  process.exit(0);
}

if (!first || !isSample(first)) die('usage: extract.mjs <sample-id> [--scaffold <axis> <slug>] | extract.mjs svgvars <file.svg>');
const id = first;
const dir = sampleDir(id);
const intake = readIntake(id);
if (!String(intake.why_collected || '').trim()) die(`${id}: why_collected が空なので処理しない（§3）`);

// ---------- scaffold ----------
const TEMPLATES = {
  motion: { kind: 'enter', curve: 'cubic-bezier(.2,.8,.2,1)', duration_ms: 500, delay_ms: 0, transform_from: 'translateY(40px)', opacity_from: 0, pair_exit: null, notes: '' },
  'motion-stagger': { kind: 'stagger', step_ms: [0, 80, 80], applies_to: ['a', 'b', 'c'], notes: '' },
  type: {
    display: { family: '', weight: 400, tracking_em: 0, leading: 1.1 },
    body: { family: '', weight: 400, tracking_em: 0, leading: 1.5 },
    scale_ratio: 3, autosize: { 2: 190, 3: 150, 4: 120, '5+': 96 }, max_chars_per_line: 20,
  },
  layout: { aspect: ['16:9'], grid: '1fr 1fr', padding: [0, 80, 0, 80], align: 'left', wireframe: '' },
  icons: { colors: 3, motifs: [] },
  palette: { rule: '', min_contrast_ink: 7.0, roles: ['bg', 'ink', 'acc', 'disc'], examples: [] },
  pacing: { scene_sec: 3.6, motion_ratio: 0.33, hold_ratio: 0.67, format: ['short'] },
};

const LAYOUT_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1920px;height:1080px;background:#fff}
  .frame{display:grid;grid-template-columns:1fr 1fr;padding:0 80px;height:100%;align-items:center;gap:60px}
  .box{background:#cfcfcf}
</style></head><body>
  <div class="frame">
    <div class="box" style="height:460px"></div>
    <div><div class="box" style="height:120px"></div></div>
  </div>
</body></html>
`;

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="20" y="20" width="160" height="160" rx="24" fill="var(--c1)"/>
  <circle cx="100" cy="100" r="50" fill="var(--c2)"/>
  <circle cx="100" cy="100" r="20" fill="var(--c3)"/>
</svg>
`;

if (args.scaffold) {
  const axis = args.scaffold === true ? rest[0] : args.scaffold;
  const slug = args.scaffold === true ? rest[1] : rest[0];
  if (!AXES.includes(axis) || !slug) die('usage: extract.mjs <id> --scaffold <axis> <slug>（icons は <category>/<slug>）');
  if (axis === 'icons' && !slug.includes('/')) die('icons の slug は <category>/<slug>');
  const partId = `${axis}.${slug.split('/').join('.')}`;
  const file = path.join(dir, 'drafts', `${idToRel(partId)}.json`);
  if (fs.existsSync(file)) die(`既に存在する: ${file}`);
  const tpl = TEMPLATES[axis === 'motion' && slug.startsWith('stagger') ? 'motion-stagger' : axis];
  writeJSON(file, {
    id: partId, axis, ...tpl,
    mood: [], fit: [], avoid: [], formats: ['short', 'long'],
    source_sample: id, license: intake.source_type === 'observation_only' ? '自社' : intake.license,
    approved: false, created_at: today(),
  });
  if (axis === 'layout') fs.writeFileSync(file.replace(/\.json$/, '.html'), LAYOUT_HTML);
  if (axis === 'icons') fs.writeFileSync(file.replace(/\.json$/, '.svg'), ICON_SVG);
  console.log(`draft: ${path.relative(process.cwd(), file)}`);
  process.exit(0);
}

// ---------- machine read ----------
const report = { sample: id, source_type: intake.source_type, generated_at: new Date().toISOString() };

if (intake.source_type === 'observation_only') {
  report.note = 'observation_only: コードは読まない。observation.md とスクリーンショットから手で数値・規則を書き起こす';
  report.screenshots = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
} else {
  const srcFile = ['source.html', 'source.htm'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  if (!srcFile) die(`${id}: source.html がない`);
  const html = fs.readFileSync(srcFile, 'utf8');
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n')
    + '\n' + [...html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => `inline{${m[1]}}`).join('\n');
  const js = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n');

  const tally = (arr) => Object.entries(arr.reduce((acc, x) => ((acc[x] = (acc[x] || 0) + 1), acc), {}))
    .sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
  const decls = (prop) => [...css.matchAll(new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`, 'gi'))].map((m) => m[1].trim());
  const toMs = (v) => (v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000);

  // Rules with their selector so curves/durations can be tied back to elements.
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim().split('\n').pop().trim(), body: m[2] }));
  report.motion = {
    curves: tally([...(css + js).matchAll(/cubic-bezier\([^)]*\)/g)].map((m) => m[0].replace(/\s+/g, ''))),
    keyframes: [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?\})\s*\}/g)].map((m) => ({ name: m[1], body: m[2].replace(/\s+/g, ' ').trim() })),
    animated_rules: rules.filter((r) => /animation|transition/.test(r.body)).map((r) => ({
      selector: r.sel,
      decl: (r.body.match(/(animation[\w-]*|transition[\w-]*)\s*:[^;]+/g) || []).map((s) => s.trim()),
    })),
    durations_ms: tally([...decls('animation'), ...decls('transition'), ...decls('animation-duration'), ...decls('transition-duration'), ...decls('animation-delay')]
      .flatMap((v) => v.match(/(?<![\w.])(?:\d*\.\d+|\d+)m?s\b/g) || []).map(toMs)),
    js_timings: tally([...js.matchAll(/\b(dur|duration|delay|hold|stagger|step|wait|t)\w*\s*[:=]\s*(\d+(?:\.\d+)?)/gi)].map((m) => `${m[1]}=${m[2]}`)),
    js_timeouts_ms: tally([...js.matchAll(/setTimeout\([^,]+,\s*(\d+)/g)].map((m) => Number(m[1]))),
  };
  report.type = {
    families: tally(decls('font-family')),
    font_links: [...html.matchAll(/<link[^>]+href="([^"]*fonts[^"]*)"/gi)].map((m) => m[1]),
    sizes: tally(decls('font-size')),
    letter_spacing: tally(decls('letter-spacing')),
    line_height: tally(decls('line-height')),
    weights: tally(decls('font-weight')),
  };
  report.layout = {
    grid_columns: tally(decls('grid-template-columns')),
    grid_rows: tally(decls('grid-template-rows')),
    padding: tally(decls('padding')),
    gap: tally(decls('gap')),
    alignment: tally([...decls('text-align'), ...decls('justify-content'), ...decls('align-items')]),
  };
  report.palette = {
    custom_properties: [...css.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g)].map((m) => ({ name: m[1], value: m[2] })),
    colors: tally([...(css + js).matchAll(COLOR_RE)].map((m) => m[0].toLowerCase())).slice(0, 40),
  };

  // Inline SVGs are only dumped for code we own or are licensed to adapt.
  // Markup SVGs only: SVGs inside <script> are picked up from js below, once.
  const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const svgs = [...markup.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)].map((m) => m[0]);
  const jsSvgs = [...js.matchAll(/`(\s*<svg\b[\s\S]*?<\/svg>\s*)`/g)].map((m) => m[1].trim());
  const all = [...new Set([...svgs, ...jsSvgs])];
  const rawDir = path.join(dir, 'drafts', '_raw-svg');
  fs.mkdirSync(rawDir, { recursive: true });
  report.icons = all.map((svg, i) => {
    const name = `svg-${String(i + 1).padStart(2, '0')}.svg`;
    fs.writeFileSync(path.join(rawDir, name), svg + '\n');
    return {
      file: `drafts/_raw-svg/${name}`,
      viewBox: (svg.match(/viewBox\s*=\s*"([^"]+)"/) || [])[1] || null,
      colors: [...new Set([...svg.matchAll(COLOR_RE)].map((m) => m[0].toLowerCase()))],
      has_gradient: /Gradient/i.test(svg),
      has_filter: /<filter|filter=/i.test(svg),
      elements: svg.match(/<(path|rect|circle|ellipse|polygon|polyline|line)\b/g)?.length || 0,
    };
  });
}

writeJSON(path.join(dir, 'extract-report.json'), report);
const m = report.motion;
console.log(`extract-report.json written for ${id}`);
if (m) {
  console.log(`  motion: ${m.curves.length} curves, ${m.keyframes.length} keyframes, ${m.animated_rules.length} animated rules`);
  console.log(`  type: ${report.type.families.length} families / layout: ${report.layout.grid_columns.length} grids / palette: ${report.palette.colors.length} colors / icons: ${report.icons.length} svgs`);
}
console.log('next: drafts を --scaffold で作り、observation.md と extract-report.json の値で埋める（approved: false のまま）');
