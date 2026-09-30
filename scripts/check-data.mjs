// Validates src/data/graph.json. Runs before every build (npm "prebuild"), so a bad
// edit to the data file fails the deploy instead of shipping a broken graph.
import { readFileSync } from 'node:fs';

const LAWS = new Set(['aiact', 'gdpr', 'both', 'other']);
const TYPES = new Set(['related', 'contrasts']);

const file = new URL('../src/data/graph.json', import.meta.url);
const { topics, terms, relations } = JSON.parse(readFileSync(file, 'utf8'));
const errors = [];

const topicIds = new Set();
for (const t of topics) {
  if (topicIds.has(t.id)) errors.push(`topic "${t.id}" is defined twice`);
  topicIds.add(t.id);
}

const termIds = new Set();
for (const t of terms) {
  if (termIds.has(t.id)) errors.push(`term "${t.id}" is defined twice`);
  termIds.add(t.id);
  for (const field of ['id', 'name', 'definition']) {
    if (!t[field]?.trim()) errors.push(`term "${t.id}" has no ${field}`);
  }
  if (!LAWS.has(t.law)) errors.push(`term "${t.id}" has unknown law "${t.law}"`);
  if (!topicIds.has(t.topic)) errors.push(`term "${t.id}" has unknown topic "${t.topic}"`);
  if (!Array.isArray(t.abbreviations) || !Array.isArray(t.aliases)) {
    errors.push(`term "${t.id}" needs abbreviations and aliases arrays`);
  }
}

const pairs = new Set();
for (const r of relations) {
  const label = `relation ${r.from} → ${r.to}`;
  for (const end of [r.from, r.to]) {
    if (!termIds.has(end)) errors.push(`${label} points to missing term "${end}"`);
  }
  if (r.from === r.to) errors.push(`${label} connects a term to itself`);
  if (!TYPES.has(r.type)) errors.push(`${label} has unknown type "${r.type}"`);
  if (r.type === 'contrasts' && !r.note?.trim()) errors.push(`${label} is a contrasts relation without a note`);
  const key = [r.from, r.to].sort().join('|');
  if (pairs.has(key)) errors.push(`${label} duplicates another relation between the same terms`);
  pairs.add(key);
}

const connected = new Set(relations.flatMap(r => [r.from, r.to]));
for (const id of termIds) if (!connected.has(id)) errors.push(`term "${id}" has no relations`);

if (errors.length) {
  console.error(`graph.json: ${errors.length} problem(s)\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`graph.json OK: ${topics.length} topics, ${terms.length} terms, ${relations.length} relations`);
