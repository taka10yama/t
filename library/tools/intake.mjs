#!/usr/bin/env node
// §3 creates inbox/<id>/ with an intake.yaml skeleton and copies a local source in.
// Usage: intake.mjs <path|url> [--id <id>] [--type own|licensed_code|observation_only]
//        [--license <name>] [--why <text>] [--axes motion,type] [--by <name>]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, list, sampleDir, toYAML, today, die, AXES } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const src = args._[0];
if (!src) die('usage: intake.mjs <path|url> [--id <id>] [--type own|licensed_code|observation_only] [--why <text>]');

const isUrl = /^https?:\/\//.test(src);
const type = args.type || (isUrl ? 'observation_only' : 'own');
if (!['own', 'licensed_code', 'observation_only'].includes(type)) die(`--type が不正: ${type}`);

const slug = (isUrl ? new URL(src).hostname.replace(/^www\./, '') : path.basename(src).replace(/\.[^.]+$/, ''))
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sample';
const id = args.id || `${today()}_${slug}`;
const dir = sampleDir(id);
if (fs.existsSync(dir)) die(`既に存在する: ${dir}`);

const axes = list(args.axes);
const badAxes = axes.filter((a) => !AXES.includes(a));
if (badAxes.length) die(`--axes に不明な軸: ${badAxes.join(', ')}`);

fs.mkdirSync(dir, { recursive: true });
const copied = [];
if (!isUrl) {
  if (!fs.existsSync(src)) die(`見つからない: ${src}`);
  const ext = path.extname(src).toLowerCase();
  // Observation-only samples keep screenshots, never other people's code (§3).
  if (type === 'observation_only' && !['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    fs.rmSync(dir, { recursive: true });
    die('observation_only のサンプルにコードは入れない（スクリーンショットのみ）');
  }
  const name = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? `source${ext}` : `source${ext || '.html'}`;
  fs.copyFileSync(src, path.join(dir, name));
  copied.push(name);
}

const license = args.license || { own: '自社', licensed_code: '', observation_only: 'なし（観察のみ）' }[type];
fs.writeFileSync(path.join(dir, 'intake.yaml'), toYAML({
  id,
  source_type: type,
  source_ref: src,
  license,
  why_collected: args.why || '',
  target_axes: axes,
  collected_by: args.by || 'Taka',
  status: 'collected',
}));

console.log(`created ${path.relative(process.cwd(), dir)}/ (${['intake.yaml', ...copied].join(', ')})`);
if (!args.why) console.log('TODO: why_collected が空。記入するまで処理しない（§3）');
if (type === 'licensed_code' && !args.license) console.log('TODO: license を記入する（MIT 等）');
