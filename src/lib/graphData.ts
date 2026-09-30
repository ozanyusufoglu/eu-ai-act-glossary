import raw from '@/data/graph.json';

export type Law = 'aiact' | 'gdpr' | 'both' | 'other';
export type RelationType = 'related' | 'contrasts';

export interface Topic {
  id: string;
  name: string;
}

export interface Term {
  id: string;
  name: string;
  abbreviations: string[];
  aliases: string[];
  law: Law;
  topic: string;
  source?: string;
  definition: string;
}

export interface Relation {
  from: string;
  to: string;
  type: RelationType;
  note?: string;
}

export interface GraphData {
  topics: Topic[];
  terms: Term[];
  relations: Relation[];
}

// scripts/check-data.mjs validates the file before every build, so the cast is safe.
export const graph = raw as GraphData;

export const LAW_NAMES: Record<Law, string> = {
  aiact: 'AI Act',
  gdpr: 'GDPR',
  both: 'Both laws',
  other: 'Standards, techniques & other',
};

/** One colour per law, matching the 2D prototype's light theme. */
export const LAW_COLORS: Record<Law, string> = {
  aiact: '#2743C4',
  gdpr: '#0D7668',
  both: '#946000',
  other: '#687086',
};

export interface Neighbor {
  id: string;
  type: RelationType;
  note?: string;
}

/** Undirected adjacency: each term's neighbours with the relation that joins them. */
export function buildAdjacency(data: GraphData): Map<string, Neighbor[]> {
  const adj = new Map<string, Neighbor[]>(data.terms.map(t => [t.id, []]));
  for (const r of data.relations) {
    adj.get(r.from)?.push({ id: r.to, type: r.type, note: r.note });
    adj.get(r.to)?.push({ id: r.from, type: r.type, note: r.note });
  }
  return adj;
}

/** Name, abbreviation and alias matches, best first: exact, then prefix, then substring. */
export function searchTerms(terms: Term[], query: string, limit = 8): Term[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { term: Term; score: number }[] = [];
  for (const term of terms) {
    let best = Infinity;
    for (const [i, s] of [term.name, ...term.abbreviations, ...term.aliases].entries()) {
      const v = s.toLowerCase();
      const rank = v === q ? 0 : v.startsWith(q) ? 1 : v.includes(q) ? 2 : Infinity;
      // Prefer a hit on the name over the same hit on an alias.
      best = Math.min(best, rank * 2 + (i === 0 ? 0 : 1));
    }
    if (best < Infinity) scored.push({ term, score: best });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.term.name.localeCompare(b.term.name))
    .slice(0, limit)
    .map(s => s.term);
}
