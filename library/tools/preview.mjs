#!/usr/bin/env node
// §5 visual check: renders each part on a neutral board to previews/<id>.png.
// Usage: preview.mjs [<sample-id> | <part-id> | --all]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { parseArgs, companion, previewPath, parseBezier, contrast, die } from './lib.mjs';
import { resolveTarget } from './validate.mjs';

const W = 1280;
const H = 720;
const BOARD = { bg: '#EDEDED', box: '#3A3A3A', line: '#B5B5B5', text: '#222', sub: '#777' };
// Neutral stand-ins for var(--c1..c5); palettes are applied at use time, not here.
const NEUTRAL_VARS = ['#2E3440', '#8FA3B8', '#E5C07B', '#C8553D', '#F2F2F2'];

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return createRequire(path.join(globalRoot, 'noop.js'))('playwright');
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function shell(title, sub, body, { css = '', head = '' } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8">${head}<style>
  *{box-sizing:border-box;margin:0}
  body{width:${W}px;height:${H}px;background:${BOARD.bg};font:14px/1.4 system-ui,sans-serif;color:${BOARD.text};overflow:hidden;position:relative}
  .hdr{position:absolute;left:32px;top:22px;right:32px;display:flex;justify-content:space-between;align-items:baseline}
  .hdr b{font-size:18px}.hdr span{color:${BOARD.sub};font-size:13px}
  .stage{position:absolute;left:32px;right:32px;top:70px;bottom:28px}
  ${css}</style></head><body><div class="hdr"><b>${esc(title)}</b><span>${esc(sub)}</span></div><div class="stage">${body}</div></body></html>`;
}

// ---------- motion ----------
function curveSVG(curve) {
  const b = parseBezier(curve) || { linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1] }[curve] || [0, 0, 1, 1];
  const S = 180;
  const pad = 40;
  const y = (v) => pad + S - v * S;
  const x = (v) => pad + v * S;
  return `<svg width="${S + pad * 2}" height="${S + pad * 2}"><rect x="${pad}" y="${pad}" width="${S}" height="${S}" fill="none" stroke="${BOARD.line}"/>
  <line x1="${x(0)}" y1="${y(0)}" x2="${x(b[0])}" y2="${y(b[1])}" stroke="#C8553D" stroke-dasharray="3 3"/>
  <line x1="${x(1)}" y1="${y(1)}" x2="${x(b[2])}" y2="${y(b[3])}" stroke="#C8553D" stroke-dasharray="3 3"/>
  <path d="M${x(0)},${y(0)} C${x(b[0])},${y(b[1])} ${x(b[2])},${y(b[3])} ${x(1)},${y(1)}" fill="none" stroke="${BOARD.box}" stroke-width="3"/>
  <text x="${pad}" y="${S + pad * 2 - 8}" font-size="12" fill="${BOARD.sub}">${esc(curve)}</text></svg>`;
}

function motionPage(d) {
  if (d.kind === 'stagger') {
    const delays = d.step_ms.reduce((acc, s, i) => [...acc, (acc[i - 1] ?? 0) + (i ? s : 0)], []);
    const total = delays.at(-1) + 400;
    const frames = [0, 0.5, 1].map((f) => Math.round(total * f));
    const cols = frames.map((t) => `<div class="col"><div class="t">t = ${t}ms</div>${d.applies_to.map((name, i) =>
      `<div class="row" data-delay="${delays[i]}" data-t="${t}">${esc(name)} <small>+${delays[i]}ms</small></div>`).join('')}</div>`).join('');
    return {
      html: shell(d.id, `stagger step_ms ${JSON.stringify(d.step_ms)} / 各要素 400ms ease-out で登場`, `<div class="grid">${cols}</div>`, {
        css: `.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;height:100%}
        .col{background:#fff;border:1px solid ${BOARD.line};padding:24px;display:flex;flex-direction:column;gap:14px}
        .t{color:${BOARD.sub};margin-bottom:10px}.row{background:${BOARD.box};color:#fff;padding:14px 16px;font-weight:600}
        .row small{opacity:.6;font-weight:400}`,
      }),
      script: `document.querySelectorAll('.row').forEach(el=>{const a=el.animate([{transform:'translateY(24px)',opacity:0},{transform:'none',opacity:1}],{duration:400,delay:+el.dataset.delay,easing:'ease-out',fill:'both'});a.pause();a.currentTime=+el.dataset.t;});`,
    };
  }
  const dur = d.duration_ms;
  const exit = d.kind === 'exit';
  const rest = { transform: 'none', opacity: 1, ...(d.clip_from || d.clip_to ? { clipPath: 'inset(0 0 0 0)' } : {}) };
  const from = { ...rest, transform: d.transform_from || 'none', opacity: d.opacity_from ?? 1, ...(d.clip_from ? { clipPath: d.clip_from } : {}) };
  const to = { ...rest, transform: d.transform_to || 'none', opacity: d.opacity_to ?? 1, ...(d.clip_to ? { clipPath: d.clip_to } : {}) };
  const kf = exit ? [rest, to] : d.kind === 'emphasis' ? [{ transform: 'none' }, { transform: d.transform_peak || 'scale(1.15)' }, { transform: 'none' }] : [from, rest];
  const frames = [0, 0.5, 1];
  const cells = frames.map((f) => `<div class="cell"><div class="t">${Math.round(f * 100)}% (${Math.round(dur * f)}ms)</div><div class="ghost"></div>${!exit && d.kind !== 'emphasis' ? `<div class="pose" style="transform:${esc(from.transform)}"></div>` : ''}<div class="obj" data-t="${dur * f}"></div></div>`).join('');
  return {
    html: shell(d.id, `${d.kind} / ${dur}ms / delay ${d.delay_ms ?? 0}ms${exit || d.kind === 'emphasis' ? '' : ' / 赤点線=開始姿勢 灰破線=終了位置'}`, `<div class="wrap"><div class="cells">${cells}</div><div class="side">${curveSVG(d.curve)}<p>${esc(d.notes || '')}</p></div></div>`, {
      css: `.wrap{display:flex;gap:24px;height:100%}.cells{flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
      .cell{background:#fff;border:1px solid ${BOARD.line};position:relative}
      .t{position:absolute;left:12px;top:10px;color:${BOARD.sub}}
      .ghost,.obj{position:absolute;left:50%;top:50%;width:140px;height:140px;margin:-70px 0 0 -70px;border-radius:18px}
      .ghost{border:2px dashed ${BOARD.line}}.pose{position:absolute;left:50%;top:50%;width:140px;height:140px;margin:-70px 0 0 -70px;border-radius:18px;border:2px dotted #C8553D}
      .obj{background:${BOARD.box}}
      .side{width:280px;display:flex;flex-direction:column;gap:12px}.side p{color:${BOARD.sub}}`,
    }),
    script: `const kf=${JSON.stringify(kf)};document.querySelectorAll('.obj').forEach(el=>{const a=el.animate(kf,{duration:${dur},easing:${JSON.stringify(d.curve)},fill:'both'});a.pause();a.currentTime=Math.min(+el.dataset.t,${dur - 0.01});});`,
  };
}

// ---------- type ----------
function fontLink(d) {
  const fams = [...new Set([d.display.family, d.body.family])];
  const q = fams.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@${f === d.display.family ? d.display.weight : d.body.weight}`).join('&');
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${q}&display=block">`;
}

function typePage(d) {
  const sizes = Object.entries(d.autosize);
  const bodyPx = Math.round(Number(sizes.at(-1)[1]) / d.scale_ratio) || 24;
  // autosize px are in the part's stage size (default 1920x1080); fit them to the board.
  const scale = 864 / ((d.stage_px && d.stage_px[0]) || 1920);
  const sample = '明治維新と近代国家の成立'.slice(0, d.max_chars_per_line);
  const specimens = sizes.map(([chars, px]) => {
    const text = sample.slice(0, chars === '5+' ? 6 : Number(chars));
    return `<div class="spec"><small>${chars}字 → ${px}px</small><div class="disp" style="font-size:${Math.round(px * scale)}px">${esc(text)}</div></div>`;
  }).join('');
  const s = (r) => `font-family:'${r.family}',sans-serif;font-weight:${r.weight};letter-spacing:${r.tracking_em}em;line-height:${r.leading}`;
  return {
    html: shell(d.id, `${d.display.family} × ${d.body.family} / ratio ${d.scale_ratio} / ${d.max_chars_per_line}字/行`,
      `<div class="specs">${specimens}</div><div class="body" style="font-size:${Math.max(14, Math.round(bodyPx * scale * 1.6))}px;max-width:${d.max_chars_per_line}em">本文サンプル：黒船来航から十五年、江戸幕府は大政奉還により政権を朝廷へ返上した。新政府は廃藩置県と地租改正で近代国家の骨格を整えていく。</div>
      <div class="meta">display: ${esc(JSON.stringify(d.display))}<br>body: ${esc(JSON.stringify(d.body))}<br>license: ${esc(d.license)}</div>`,
      { css: `.specs{display:flex;flex-wrap:wrap;gap:10px 36px;align-items:flex-end}.spec small{color:${BOARD.sub};display:block}
      .disp{${s(d.display)};white-space:nowrap}.body{${s(d.body)};margin-top:22px;background:#fff;padding:16px 20px;border:1px solid ${BOARD.line}}
      .meta{position:absolute;bottom:0;color:${BOARD.sub};font:12px/1.5 ui-monospace,monospace}`, head: fontLink(d) }),
  };
}

// ---------- layout ----------
function layoutPage(d, part) {
  const html = fs.readFileSync(companion(part, '.html'), 'utf8');
  const [aw, ah] = d.aspect[0].split(':').map(Number);
  const frameH = H - 110;
  const frameW = Math.min(W - 64, Math.round((frameH * aw) / ah));
  const nativeW = (d.stage_px && d.stage_px[0]) || (aw >= ah ? 1920 : 1080);
  const nativeH = (d.stage_px && d.stage_px[1]) || Math.round((nativeW * ah) / aw);
  return {
    html: shell(d.id, `${d.aspect.join(', ')} / grid ${d.grid} / padding ${d.padding.join(' ')} / ${d.align}`,
      `<div class="frame" style="width:${frameW}px;height:${Math.round((frameW * ah) / aw)}px"><iframe srcdoc="${esc(html)}" style="width:${nativeW}px;height:${nativeH}px;transform:scale(${frameW / nativeW})"></iframe></div><div class="wf">${esc(d.wireframe)}</div>`,
      { css: `.frame{background:#fff;border:1px solid ${BOARD.line};overflow:hidden;position:relative}
      iframe{border:0;transform-origin:0 0;position:absolute;left:0;top:0}.wf{margin-top:8px;color:${BOARD.sub};font-family:ui-monospace,monospace}` }),
  };
}

// ---------- icons ----------
function iconPage(d, part) {
  const svg = fs.readFileSync(companion(part, '.svg'), 'utf8');
  // default_colors = the colors the icon was drawn with; neutral set shows it survives re-coloring.
  const own = d.default_colors ? Object.keys(d.default_colors).sort().map((k) => d.default_colors[k]) : null;
  const main = own || NEUTRAL_VARS;
  const vars = (cs) => cs.map((c, i) => `--c${i + 1}:${c}`).join(';');
  const sizes = [320, 160, 64, 32];
  const legend = (cs, note) => `<div class="legend">${cs.map((c, i) => `<span><i style="background:${c}"></i>--c${i + 1} ${own ? c : ''}</span>`).join('')}${note}</div>`;
  return {
    html: shell(d.id, `${d.colors}色 / motifs: ${d.motifs.join('・')}`,
      `<div class="row" style="${vars(main)}">${sizes.map((s) => `<div class="ic" style="width:${s}px;height:${s}px">${svg}</div>`).join('')}
      <div class="ic dark" style="width:160px;height:160px">${svg}</div>${own ? `<div class="ic" style="width:160px;height:160px;${vars(NEUTRAL_VARS)}">${svg}</div>` : ''}</div>
      ${legend(main.slice(0, d.colors), own ? '（描いたときの色。右端は中立色に差し替えた例）' : '（仮の中立色。本番は palette の規則で差し込む）')}`,
      { css: `.row{display:flex;gap:28px;align-items:flex-end;margin-top:30px}.ic{background:#fff;border:1px solid ${BOARD.line}}
      .ic.dark{background:#1b1b1b}.ic svg{width:100%;height:100%;display:block}
      .legend{margin-top:40px;color:${BOARD.sub};display:flex;gap:16px;align-items:center}
      .legend i{display:inline-block;width:14px;height:14px;margin-right:4px;vertical-align:-2px;border:1px solid #0002}` }),
  };
}

// ---------- palette ----------
function palettePage(d) {
  const roles = d.roles || ['bg', 'ink', 'acc', 'disc'];
  const col = (ex, r) => ex[roles.indexOf(r)];
  // Up to 5 cards per row; with many examples the cards shrink but keep 16:9 so text never reflows.
  const n = d.examples.length;
  const perRow = Math.min(5, n);
  const rows = Math.ceil(n / perRow);
  const cw = Math.floor((W - 64 - (perRow - 1) * 16) / perRow);
  const ch = Math.min(Math.round((cw * 9) / 16), Math.floor((520 - (rows - 1) * 16) / rows) - 22);
  const k = ch / 260; // type scale relative to a 260px-high card
  const cards = d.examples.map((ex, j) => {
    const [bg, ink, acc, disc] = ['bg', 'ink', 'acc', 'disc'].map((r) => col(ex, r));
    const label = (d.example_labels && d.example_labels[j]) || `examples[${j}]`;
    return `<figure><div class="card" style="background:${bg};color:${ink};height:${ch}px">
      ${disc ? `<div class="disc" style="background:${disc}"></div>` : ''}
      <div class="num" style="color:${acc || ink}">01</div><div class="ttl">見出し</div><div class="bd">本文の読みやすさ</div>
      <div class="sw">${ex.map((c) => `<i style="background:${c}"></i>`).join('')}</div></div>
      <figcaption>${esc(label)}　ink ${contrast(bg, ink).toFixed(1)} / acc ${acc ? contrast(bg, acc).toFixed(1) : '-'}</figcaption></figure>`;
  }).join('');
  return {
    html: shell(d.id, `min_contrast_ink ${d.min_contrast_ink}${d.min_contrast_acc ? ` / min_contrast_acc ${d.min_contrast_acc}` : ''} / roles ${roles.join(',')}`,
      `<div class="cards" style="grid-template-columns:repeat(${perRow},${cw}px)">${cards}</div><p class="rule">${esc(d.rule)}</p>`, {
      css: `.cards{display:grid;gap:16px}figure{margin:0}.card{position:relative;padding:${Math.round(22 * k)}px;overflow:hidden;border:1px solid ${BOARD.line}}
      .disc{position:absolute;right:${Math.round(-40 * k)}px;top:${Math.round(-40 * k)}px;width:${Math.round(200 * k)}px;height:${Math.round(200 * k)}px;border-radius:50%}
      .num{font-size:${Math.round(30 * k)}px;font-weight:800;position:relative;line-height:1}
      .ttl{font-size:${Math.round(56 * k)}px;font-weight:800;position:relative;line-height:1.15;white-space:nowrap}
      .bd{font-size:${Math.round(20 * k)}px;position:relative;margin-top:${Math.round(6 * k)}px;white-space:nowrap}
      .sw{position:absolute;right:8px;bottom:8px;display:flex;gap:3px}
      .sw i{display:block;width:${Math.max(10, Math.round(18 * k))}px;height:${Math.max(10, Math.round(18 * k))}px;border:1px solid #fff8;outline:1px solid #0003}
      figcaption{font:12px ui-monospace,monospace;color:${BOARD.sub};margin-top:4px}
      .rule{margin-top:14px;font-size:14px;line-height:1.5}`,
    }),
  };
}

// ---------- pacing ----------
function pacingPage(d) {
  const bar = (sec, label) => {
    const m = sec * d.motion_ratio;
    return `<div class="lane"><div class="lbl">${label}</div><div class="bar"><div class="mv" style="flex:${d.motion_ratio}">動き ${m.toFixed(2)}s</div><div class="hd" style="flex:${d.hold_ratio}">静止 ${(sec - m).toFixed(2)}s</div></div></div>`;
  };
  return {
    html: shell(d.id, `scene ${d.scene_sec}s / motion ${d.motion_ratio} : hold ${d.hold_ratio} / ${(d.format || d.formats || []).join(', ')}`,
      `${bar(d.scene_sec, `1シーン ${d.scene_sec}s`)}<div class="seq">${Array.from({ length: Math.max(1, Math.floor(60 / d.scene_sec)) }, () => `<div style="flex:1;display:flex"><div class="mv" style="flex:${d.motion_ratio}"></div><div class="hd" style="flex:${d.hold_ratio}"></div></div>`).join('')}</div><div class="cap">60秒に並べた場合（${Math.floor(60 / d.scene_sec)}シーン）</div>`,
      { css: `.lane{display:flex;align-items:center;gap:16px;margin-top:60px}.lbl{width:160px;color:${BOARD.sub}}
      .bar{flex:1;display:flex;height:90px}.mv{background:${BOARD.box};color:#fff;display:flex;align-items:center;padding-left:14px}
      .hd{background:#fff;border:1px solid ${BOARD.line};display:flex;align-items:center;padding-left:14px}
      .seq{display:flex;gap:3px;height:40px;margin-top:80px}.cap{color:${BOARD.sub};margin-top:8px}` }),
  };
}

const PAGES = { motion: motionPage, type: typePage, layout: layoutPage, icons: iconPage, palette: palettePage, pacing: pacingPage };

export async function renderPreviews(parts) {
  const { chromium } = await loadPlaywright();
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  // Web fonts are fetched Node-side so a TLS-intercepting proxy's CA (NODE_EXTRA_CA_CERTS) is honored.
  await context.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    try { await route.fulfill({ response: await route.fetch() }); } catch { await route.abort(); }
  });
  const page = await context.newPage();
  const results = [];
  for (const part of parts) {
    const d = part.data;
    const out = previewPath(d.id);
    try {
      const { html, script } = PAGES[d.axis](d, part);
      await page.setContent(html, { waitUntil: 'load', timeout: 15000 }).catch(() => page.setContent(html, { waitUntil: 'domcontentloaded' }));
      await page.evaluate(() => document.fonts.ready);
      if (script) await page.evaluate(script);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await page.screenshot({ path: out });
      const r = { id: d.id, out };
      if (d.axis === 'type') {
        const missing = [];
        for (const f of new Set([d.display.family, d.body.family])) {
          if (!(await page.evaluate((fam) => document.fonts.check(`20px "${fam}"`, '明治') && [...document.fonts].some((x) => x.family.replace(/"/g, '') === fam && x.status === 'loaded'), f))) missing.push(f);
        }
        if (missing.length) r.warning = `フォント未読込（代替フォントで描画）: ${missing.join(', ')}`;
      }
      results.push(r);
    } catch (e) {
      results.push({ id: d.id, error: e.message });
    }
  }
  await browser.close();
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { parts } = resolveTarget(args.all ? '--all' : args._[0]);
  const ok = parts.filter((x) => !x.data.__parseError && PAGES[x.data.axis]);
  if (!ok.length) die('プレビュー対象の部品がない');
  const results = await renderPreviews(ok);
  for (const r of results) {
    console.log(r.error ? `FAIL ${r.id}: ${r.error}` : `ok   ${r.id} → ${path.relative(process.cwd(), r.out)}`);
    if (r.warning) console.log(`       ! ${r.warning}`);
  }
  process.exit(results.some((r) => r.error) ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
