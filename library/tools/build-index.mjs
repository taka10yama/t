#!/usr/bin/env node
// §6 regenerates index.json from every registered part.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AXES, ROOT, p, loadRegistered, writeJSON, previewPath, companion } from './lib.mjs';

const INDEX_KEYS = ['id', 'axis', 'mood', 'fit', 'avoid', 'formats', 'source_sample', 'license', 'approved', 'approved_by', 'created_at'];

export function buildIndex() {
  const parts = loadRegistered()
    .filter((x) => !x.data.__parseError)
    .sort((a, b) => a.data.id.localeCompare(b.data.id));
  const entries = parts.map(({ data, file, ...part }) => {
    const e = Object.fromEntries(INDEX_KEYS.filter((k) => data[k] !== undefined).map((k) => [k, data[k]]));
    const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
    e.file = rel(file);
    for (const ext of ['.svg', '.html']) {
      const c = companion({ file, ...part }, ext);
      if (fs.existsSync(c)) e.asset = rel(c);
    }
    const pv = previewPath(data.id);
    e.preview = fs.existsSync(pv) ? rel(pv) : null;
    return e;
  });
  const counts = Object.fromEntries(AXES.map((a) => [a, entries.filter((e) => e.axis === a).length]));
  const index = { generated_at: new Date().toISOString(), total: entries.length, counts, parts: entries };
  writeJSON(p('index.json'), index);
  return index;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const idx = buildIndex();
  console.log(`index.json: ${idx.total} parts ${JSON.stringify(idx.counts)}`);
}
