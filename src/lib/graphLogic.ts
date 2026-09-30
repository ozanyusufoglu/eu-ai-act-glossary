import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY, forceZ } from 'd3-force-3d';
import type { GraphData, RelationType } from '@/lib/graphData';

export interface LayoutNode {
  id: string;
  topic: string;
  degree: number;
  x: number;
  y: number;
  z: number;
}

interface LayoutLink {
  source: string | LayoutNode;
  target: string | LayoutNode;
  type: RelationType;
}

export interface Layout {
  nodes: LayoutNode[];
  /** Where each topic cluster sits, for its label. */
  topicCenters: Map<string, { x: number; y: number; z: number }>;
  /** Distance from the origin to the farthest node. */
  radius: number;
}

const TOPIC_SPREAD = 230; // radius of the sphere the topic clusters sit on
const TICKS = 400;

/** Small deterministic PRNG, so the layout is identical on every load. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Evenly spaced points on a sphere (Fibonacci lattice), one per topic. */
function spherePoints(n: number, r: number) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n;
    const ring = Math.sqrt(1 - y * y);
    return { x: Math.cos(golden * i) * ring * r, y: y * r, z: Math.sin(golden * i) * ring * r };
  });
}

export function computeLayout(data: GraphData): Layout {
  const random = lcg(20260929);
  const anchors = spherePoints(data.topics.length, TOPIC_SPREAD);
  const anchorOf = new Map(data.topics.map((t, i) => [t.id, anchors[i]]));

  const degree = new Map<string, number>(data.terms.map(t => [t.id, 0]));
  for (const r of data.relations) {
    degree.set(r.from, (degree.get(r.from) ?? 0) + 1);
    degree.set(r.to, (degree.get(r.to) ?? 0) + 1);
  }

  const nodes: LayoutNode[] = data.terms.map(t => {
    const a = anchorOf.get(t.topic)!;
    return {
      id: t.id,
      topic: t.topic,
      degree: degree.get(t.id) ?? 0,
      x: a.x + (random() - 0.5) * 60,
      y: a.y + (random() - 0.5) * 60,
      z: a.z + (random() - 0.5) * 60,
    };
  });
  const links: LayoutLink[] = data.relations.map(r => ({ source: r.from, target: r.to, type: r.type }));

  const anchor = (n: LayoutNode) => anchorOf.get(n.topic)!;
  forceSimulation(nodes, 3)
    .randomSource(random)
    .force('link', forceLink(links).id((n: LayoutNode) => n.id)
      .distance((l: LayoutLink) => (l.type === 'contrasts' ? 70 : 45))
      .strength(0.08))
    .force('charge', forceManyBody().strength(-70).distanceMax(260))
    .force('collide', forceCollide((n: LayoutNode) => nodeRadius(n.degree) + 6).iterations(2))
    .force('x', forceX((n: LayoutNode) => anchor(n).x).strength(0.14))
    .force('y', forceY((n: LayoutNode) => anchor(n).y).strength(0.14))
    .force('z', forceZ((n: LayoutNode) => anchor(n).z).strength(0.14))
    .stop()
    .tick(TICKS);

  // Recentre on the origin: the camera orbits it and a selected node is brought to it.
  const mean = { x: 0, y: 0, z: 0 };
  for (const n of nodes) { mean.x += n.x; mean.y += n.y; mean.z += n.z; }
  for (const k of ['x', 'y', 'z'] as const) mean[k] /= nodes.length;
  for (const n of nodes) { n.x -= mean.x; n.y -= mean.y; n.z -= mean.z; }

  const topicCenters = new Map<string, { x: number; y: number; z: number }>();
  for (const t of data.topics) {
    const members = nodes.filter(n => n.topic === t.id);
    const c = { x: 0, y: 0, z: 0 };
    for (const n of members) { c.x += n.x; c.y += n.y; c.z += n.z; }
    topicCenters.set(t.id, { x: c.x / members.length, y: c.y / members.length, z: c.z / members.length });
  }

  const radius = Math.max(...nodes.map(n => Math.hypot(n.x, n.y, n.z)));
  return { nodes, topicCenters, radius };
}

/** Node radius in world units: grows with the number of connections. */
export function nodeRadius(degree: number) {
  return 2.6 + Math.sqrt(degree) * 1.25;
}
