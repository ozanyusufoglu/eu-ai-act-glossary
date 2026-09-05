import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceRadial } from 'd3-force-3d';

export interface Node {
  id: string;
  label: string;
  group: number;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

export interface Link {
  source: string | Node;
  target: string | Node;
  value: number;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

export function generateGraphData(): GraphData {
  const nodes: Node[] = [
    { id: 'center', label: '3d-Graph', group: 0 },
    { id: 'node_0', label: 'React', group: 1 },
    { id: 'node_1', label: 'TypeScript', group: 1 },
    { id: 'node_2', label: 'Next.js', group: 1 },
    { id: 'node_3', label: 'Three.js', group: 2 },
    { id: 'node_4', label: 'WebGL', group: 2 },
    { id: 'node_5', label: 'Node.js', group: 3 },
    { id: 'node_6', label: 'GraphQL', group: 3 },
    { id: 'node_7', label: 'Tailwind', group: 1 },
    { id: 'node_8', label: 'Docker', group: 4 },
    { id: 'node_9', label: 'Rust', group: 4 },
  ];

  const links: Link[] = [
    // Central connections
    { source: 'center', target: 'node_0', value: 1 },
    { source: 'center', target: 'node_1', value: 1 },
    { source: 'center', target: 'node_2', value: 1 },
    { source: 'center', target: 'node_3', value: 1 },
    { source: 'center', target: 'node_5', value: 1 },
    { source: 'center', target: 'node_8', value: 1 },

    // Periphery connections
    { source: 'node_0', target: 'node_1', value: 0.5 },
    { source: 'node_0', target: 'node_7', value: 0.5 },
    { source: 'node_1', target: 'node_2', value: 0.5 },
    { source: 'node_3', target: 'node_4', value: 0.5 },
    { source: 'node_5', target: 'node_6', value: 0.5 },
    { source: 'node_8', target: 'node_9', value: 0.5 },
    { source: 'node_2', target: 'node_6', value: 0.2 },
    { source: 'node_4', target: 'node_9', value: 0.2 },
  ];

  return { nodes, links };
}

export function createSimulation(data: GraphData) {
  const simulation = forceSimulation(data.nodes as Node[], 3)
    .force('link', forceLink(data.links).id((d: any) => d.id).distance((d: any) => d.source.id === 'center' ? 120 : 80))
    .force('charge', forceManyBody().strength(-300))
    .force('center', forceCenter(0, 0, 0))
    .force('collide', forceCollide().radius(40))
    .force('radial', forceRadial(150, 0, 0, 0).strength(0.1)); // Adds a soft spherical bounds effect

  return simulation;
}
