#!/usr/bin/env node
// §11-2 end-to-end check with dummy parts, run against a throwaway LIBRARY_ROOT.
// Usage: selftest.mjs [--keep] [--no-preview]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { TOOLS_DIR } from './lib.mjs';

const keep = process.argv.includes('--keep');
const noPreview = process.argv.includes('--no-preview');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-selftest-'));
fs.copyFileSync(path.join(TOOLS_DIR, '..', 'vocab.json'), path.join(root, 'vocab.json'));
fs.writeFileSync(path.join(root, 'usage-log.jsonl'), '');

let failures = 0;
function run(tool, args, { expect = 0 } = {}) {
  const r = spawnSync(process.execPath, [path.join(TOOLS_DIR, tool), ...args], { env: { ...process.env, LIBRARY_ROOT: root }, encoding: 'utf8', cwd: root });
  const ok = expect === 'any' || r.status === expect || (expect === 'fail' && r.status !== 0);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${tool} ${args.join(' ')} → exit ${r.status}`);
  if (!ok) { failures++; console.log(r.stdout + r.stderr); }
  return r.stdout + r.stderr;
}
function assert(cond, msg) {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
}
const J = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const W = (f, data) => {
  fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
  fs.writeFileSync(path.join(root, f), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
};

// ① intake
const src = path.join(root, 'dummy.html');
fs.writeFileSync(src, `<!doctype html><html><head><style>
  :root{--bg:#1F3B6E;--ink:#F4EFE4;--acc:#F2B84B}
  .title{font-family:'Dela Gothic One';letter-spacing:-.02em;line-height:1.05;animation:pop .6s cubic-bezier(.3,1.5,.5,1) .15s both}
  .grid{display:grid;grid-template-columns:560px 1fr;padding:0 90px 0 70px}
  @keyframes pop{from{transform:scale(.4) rotate(-8deg);opacity:0}to{transform:none;opacity:1}}
</style></head><body><div class="grid"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="80" fill="#F2B84B"/></svg><h1 class="title">題</h1></div>
<script>const dur = 600; setTimeout(()=>{}, 3600);</script></body></html>`);
const S = 'selftest_dummy';
run('intake.mjs', [src, '--id', S]);
run('extract.mjs', [S], { expect: 'fail' }); // why_collected is empty -> refused
fs.writeFileSync(path.join(root, 'inbox', S, 'intake.yaml'),
  fs.readFileSync(path.join(root, 'inbox', S, 'intake.yaml'), 'utf8').replace('why_collected: ""', 'why_collected: "ダミー: ツールの通し確認"'));
run('status.mjs', [S, 'observed']);
fs.writeFileSync(path.join(root, 'inbox', S, 'observation.md'), '# dummy\n- icons 以外は全軸取り出す\n');

// ③ extract
run('extract.mjs', [S]);
const rep = J(`inbox/${S}/extract-report.json`);
assert(rep.motion.curves[0]?.value === 'cubic-bezier(.3,1.5,.5,1)', 'extract: curve を拾う');
assert(rep.layout.grid_columns[0]?.value === '560px 1fr', 'extract: grid を拾う');
assert(rep.icons.length === 1, 'extract: インラインSVGを _raw-svg に出す');

for (const [axis, slug] of [['motion', 'pop-overshoot'], ['motion', 'stagger-text-4'], ['type', 'dela-zen-display'], ['layout', 'split-art-left'],
  ['icons', 'misc/target'], ['palette', 'traditional-single-ground'], ['pacing', 'act-then-hold'], ['motion', 'too-slow']]) {
  run('extract.mjs', [S, '--scaffold', axis, slug]);
}
const D = `inbox/${S}/drafts`;
const meta = (x) => ({ ...J(`${D}/${x}.json`), mood: ['力強い', 'ポップ'], fit: ['歴史', '教育'], avoid: ['金融'] });
W(`${D}/motion/pop-overshoot.json`, { ...meta('motion/pop-overshoot'), curve: 'cubic-bezier(.3,1.5,.5,1)', duration_ms: 600, delay_ms: 150, transform_from: 'scale(.4) rotate(-8deg)', opacity_from: 0 });
W(`${D}/motion/stagger-text-4.json`, { ...meta('motion/stagger-text-4'), step_ms: [0, 80, 140, 140], applies_to: ['num', 'title', 'date', 'body'] });
W(`${D}/type/dela-zen-display.json`, {
  ...meta('type/dela-zen-display'),
  display: { family: 'Dela Gothic One', weight: 400, tracking_em: -0.02, leading: 1.05 },
  body: { family: 'Zen Kaku Gothic New', weight: 700, tracking_em: 0, leading: 1.45 },
  scale_ratio: 5, license: 'SIL OFL（Google Fonts）',
});
W(`${D}/layout/split-art-left.json`, { ...meta('layout/split-art-left'), grid: '560px 1fr', padding: [0, 90, 0, 70], wireframe: '[ ART 460 ] [ num / TITLE / date / body ]' });
W(`${D}/palette/traditional-single-ground.json`, {
  ...meta('palette/traditional-single-ground'),
  rule: '背景に伝統色1色。discは背景の明度を±6%。inkは背景とのコントラスト比7:1以上',
  examples: [['#1F3B6E', '#F4EFE4', '#F2B84B', '#2A4B85'], ['#F4EFE4', '#1F3B6E', '#C8553D', '#E8E1D2']],
});
W(`${D}/pacing/act-then-hold.json`, { ...meta('pacing/act-then-hold') });
W(`${D}/icons/misc/target.json`, { ...meta('icons/misc/target'), colors: 3, motifs: ['的', '目標'] });
W(`${D}/motion/too-slow.json`, { ...meta('motion/too-slow'), duration_ms: 1500, mood: ['存在しない語'] });
run('status.mjs', [S, 'extracted']);

// ⑤ validate: the deliberately broken draft must fail with the expected reasons.
const vout = run('validate.mjs', [S], { expect: 'fail' });
assert(/too-slow[\s\S]*150〜900ms/.test(vout), 'validate: duration 範囲外を検出');
assert(/語彙表にない語: 存在しない語/.test(vout), 'validate: 語彙外の mood を検出');
fs.rmSync(path.join(root, D, 'motion/too-slow.json'));

// Negative SVG / palette / license checks on scratch copies.
W(`${D}/icons/misc/bad.svg`, '<svg viewBox="0 0 100 100"><defs><linearGradient id="g"/></defs><rect fill="#ff0000"/></svg>');
W(`${D}/icons/misc/bad.json`, { ...meta('icons/misc/target'), id: 'icons.misc.bad', colors: 1, motifs: ['x'] });
W(`${D}/palette/low-contrast.json`, { ...meta('palette/traditional-single-ground'), id: 'palette.low-contrast', rule: 'x', min_contrast_ink: 7, examples: [['#777777', '#888888', '#F2B84B', '#666666']], license: '不明' });
W(`${D}/motion/dup.json`, { ...J(`${D}/motion/pop-overshoot.json`), id: 'motion.dup', curve: 'cubic-bezier(.32,1.52,.5,1)' });
const nout = run('validate.mjs', [S], { expect: 'fail' });
assert(/viewBox/.test(nout) && /グラデーション/.test(nout) && /生の色/.test(nout), 'validate: SVG ルール違反を検出');
assert(/コントラスト/.test(nout) && /license "不明"/.test(nout), 'validate: コントラスト不足とライセンス不明を検出');
assert(/motion.pop-overshoot とほぼ同じ/.test(nout), 'validate: 重複を検出');
for (const f of ['icons/misc/bad.svg', 'icons/misc/bad.json', 'palette/low-contrast.json', 'motion/dup.json']) fs.rmSync(path.join(root, D, f));
run('validate.mjs', [S]);

// ⑤ preview
if (!noPreview) {
  run('preview.mjs', [S]);
  const pngs = fs.readdirSync(path.join(root, 'previews'));
  assert(pngs.length === 7, `preview: PNG 7枚（実際 ${pngs.length}）`);
} else {
  // Stand-in previews so the register path can still be exercised without a browser.
  fs.mkdirSync(path.join(root, 'previews'), { recursive: true });
  for (const id of ['motion.pop-overshoot', 'motion.stagger-text-4', 'type.dela-zen-display', 'layout.split-art-left', 'icons.misc.target', 'palette.traditional-single-ground', 'pacing.act-then-hold']) {
    fs.writeFileSync(path.join(root, 'previews', `${id}.png`), '');
  }
}
run('status.mjs', [S, 'validated']);

// ⑥ register
run('register.mjs', [S]);
let idx = J('index.json');
assert(idx.total === 7, `register: 7件登録（実際 ${idx.total}）`);
assert(idx.parts.find((x) => x.id === 'motion.pop-overshoot')?.approved === true, 'register: motion は自動で approved');
assert(idx.parts.find((x) => x.id === 'icons.misc.target')?.approved === false, 'register: icons は承認待ち');
assert(/status: awaiting_approval/.test(fs.readFileSync(path.join(root, 'inbox', S, 'intake.yaml'), 'utf8')), 'register: status awaiting_approval');
run('register.mjs', ['--approve', 'icons.misc.target'], { expect: 'fail' }); // --by missing
run('register.mjs', ['--approve', 'icons.misc.target', '--by', 'Taka']);
run('register.mjs', ['--approve', 'palette.traditional-single-ground', '--by', 'Taka']);
assert(/status: registered/.test(fs.readFileSync(path.join(root, 'inbox', S, 'intake.yaml'), 'utf8')), 'approve: 全承認で status registered');
idx = J('index.json');
assert(idx.parts.every((x) => x.approved), 'approve: 全件 approved');

// ⑦ pick / usage / report
const pout = run('pick.mjs', ['--mood', '力強い', '--fit', '歴史', '--format', 'short', '--n', '3']);
assert(/1\. motion\.pop-overshoot/.test(pout), 'pick: motion 候補が出る');
assert(/推奨の組み合わせ（§7 ルール適合）: なし/.test(pout), 'pick: 同一サンプル3軸以上の組み合わせは推奨しない');
assert(/\[motion\] 候補なし|\[motion\]\n/.test(run('pick.mjs', ['--fit', '金融'])), 'pick: avoid に当たる部品は除外');
const combo = 'motion.pop-overshoot,type.dela-zen-display,palette.traditional-single-ground';
assert(/同じサンプル/.test(run('pick.mjs', ['--check', combo], { expect: 'fail' })), 'check: 同一サンプル3軸を検出');
run('log-usage.mjs', ['v1', 'motion.pop-overshoot', 'pacing.act-then-hold']);
run('log-usage.mjs', ['v1', 'motion.pop-overshoot'], { expect: 'fail' });
run('log-usage.mjs', ['--result', 'v1', '--views_7d', '1200']);
const rout = run('report.mjs', []);
assert(/部品 7 件/.test(rout) && /承認待ち（0）/.test(rout), 'report: 集計が出る');

console.log(`\n${failures ? `FAILED: ${failures}` : 'ALL PASSED'}  (root: ${root}${keep ? '' : ', removed'})`);
if (!keep) fs.rmSync(root, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
