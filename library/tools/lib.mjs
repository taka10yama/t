// Shared helpers for the design-asset library tools.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
// LIBRARY_ROOT lets selftest.mjs run everything against a throwaway copy.
export const ROOT = path.resolve(process.env.LIBRARY_ROOT || path.join(TOOLS_DIR, '..'));
export const AXES = ['motion', 'type', 'layout', 'icons', 'palette', 'pacing'];
export const HUMAN_APPROVAL_AXES = ['icons', 'palette'];
export const STATUSES = ['collected', 'observed', 'extracted', 'validated', 'awaiting_approval', 'registered'];

export const p = (...xs) => path.join(ROOT, ...xs);
export const today = () => new Date().toISOString().slice(0, 10);

export function readJSON(file, fallback) {
  if (fallback !== undefined && !fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function readJSONL(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

export const vocab = () => readJSON(p('vocab.json'));

// ---------- args ----------
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

export const list = (v) => (v === undefined || v === true ? [] : String(v).split(',').map((s) => s.trim()).filter(Boolean));

// ---------- minimal YAML (intake.yaml only: key: value, [a, b], # comments) ----------
function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; }
    else if (c === '"' || c === "'") q = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

function yamlScalar(v) {
  v = v.trim();
  if (v === '') return '';
  if (/^".*"$/.test(v) || /^'.*'$/.test(v)) return v.slice(1, -1);
  if (v.startsWith('[') && v.endsWith(']')) {
    return v.slice(1, -1).split(',').map((s) => yamlScalar(s)).filter((s) => s !== '');
  }
  if (v === 'true' || v === 'false') return v === 'true';
  if (v === 'null' || v === '~') return null;
  return v;
}

export function parseYAML(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = stripComment(raw);
    const m = line.match(/^([A-Za-z_][\w-]*):(.*)$/);
    if (m) out[m[1]] = yamlScalar(m[2]);
  }
  return out;
}

const yamlQuote = (v) => (typeof v === 'string' && (v === '' || /[:#\[\]{},"']|^\s|\s$/.test(v)) ? JSON.stringify(v) : v);

export function toYAML(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.map(yamlQuote).join(', ')}]` : v === null ? 'null' : yamlQuote(v)}`)
    .join('\n') + '\n';
}

// ---------- inbox samples ----------
export const sampleDir = (id) => p('inbox', id);
export const isSample = (id) => fs.existsSync(path.join(sampleDir(id), 'intake.yaml'));

export function readIntake(id) {
  return parseYAML(fs.readFileSync(path.join(sampleDir(id), 'intake.yaml'), 'utf8'));
}

// Rewrites only the status line so hand-written comments in intake.yaml survive.
export function setStatus(id, status) {
  if (!STATUSES.includes(status)) throw new Error(`unknown status: ${status}`);
  const file = path.join(sampleDir(id), 'intake.yaml');
  let text = fs.readFileSync(file, 'utf8');
  if (/^status:.*$/m.test(text)) text = text.replace(/^status:.*$/m, `status: ${status}`);
  else text = text.replace(/\n?$/, `\nstatus: ${status}\n`);
  fs.writeFileSync(file, text);
}

// ---------- parts ----------
// Part id <-> path: "icons.transport.steam-locomotive" -> icons/transport/steam-locomotive.json
export function idToRel(id) {
  const [axis, ...rest] = id.split('.');
  return path.join(axis, ...rest);
}

export function relToId(relNoExt) {
  return relNoExt.split(path.sep).join('.');
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name.endsWith('.json')) acc.push(full);
  }
  return acc;
}

// Loads every part JSON under base (library root or a sample's drafts/).
export function loadParts(base = ROOT) {
  const parts = [];
  for (const axis of AXES) {
    for (const file of walk(path.join(base, axis))) {
      const rel = path.relative(base, file).replace(/\.json$/, '');
      let data;
      try { data = readJSON(file); } catch (e) { data = { __parseError: e.message }; }
      parts.push({ file, base, rel, expectedId: relToId(rel), data });
    }
  }
  return parts;
}

export const loadRegistered = () => loadParts(ROOT);
export const loadDrafts = (sampleId) => loadParts(path.join(sampleDir(sampleId), 'drafts'));

export function findPart(id) {
  return loadRegistered().find((x) => x.data.id === id);
}

export function companion(part, ext) {
  return part.file.replace(/\.json$/, ext);
}

export const previewPath = (id) => p('previews', `${id}.png`);

// ---------- color ----------
export function parseColor(s) {
  s = String(s).trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  m = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return m.slice(1, 4).map(Number);
  return null;
}

function relLum([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a, b) {
  const [x, y] = [relLum(parseColor(a)), relLum(parseColor(b))].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// ---------- motion ----------
export function parseBezier(curve) {
  const m = String(curve).match(/cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
  return m ? m.slice(1).map(Number) : null;
}

// ---------- misc ----------
export function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}
