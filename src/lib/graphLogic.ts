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
    { id: 'center',   label: 'Mental Health', group: 0 },

    // Conditions / disorders
    { id: 'node_0',  label: 'Anxiety',       group: 1 },
    { id: 'node_1',  label: 'Depression',    group: 1 },
    { id: 'node_2',  label: 'Burnout',       group: 1 },
    { id: 'node_3',  label: 'Grief',         group: 1 },
    { id: 'node_4',  label: 'Fear',          group: 1 },

    // Poetic words
    { id: 'node_5',  label: 'Solitude',     group: 2 },
    { id: 'node_6',  label: 'Longing',      group: 2 },
    { id: 'node_7',  label: 'Stillness',    group: 2 },
    { id: 'node_8',  label: 'Melancholy',   group: 2 },

    // Core psychological concepts
    { id: 'node_9',  label: 'Trauma',        group: 3 },
    { id: 'node_10', label: 'Attachment',    group: 3 },
    { id: 'node_11', label: 'Resilience',    group: 3 },
    { id: 'node_12', label: 'Vulnerability', group: 3 },

    // Emotional states
    { id: 'node_13', label: 'Empathy',       group: 4 },
    { id: 'node_14', label: 'Compassion',    group: 4 },
    { id: 'node_15', label: 'Hope',          group: 4 },
    { id: 'node_16', label: 'Rumination',    group: 4 },

    // Wellbeing practices
    { id: 'node_17', label: 'Self-Care',     group: 5 },
    { id: 'node_18', label: 'Boundaries',    group: 5 },
    { id: 'node_19', label: 'Coping',        group: 5 },
    { id: 'node_20', label: 'Sleep',         group: 5 },
    { id: 'node_21', label: 'Stress',        group: 5 },
  ];

  const links: Link[] = [
    // Central hub connections
    { source: 'center',   target: 'node_0',  value: 1 },
    { source: 'center',   target: 'node_1',  value: 1 },
    { source: 'center',   target: 'node_2',  value: 1 },
    { source: 'center',   target: 'node_3',  value: 1 },
    { source: 'center',   target: 'node_5',  value: 1 },
    { source: 'center',   target: 'node_9',  value: 1 },
    { source: 'center',   target: 'node_11', value: 1 },
    { source: 'center',   target: 'node_17', value: 1 },

    // Conditions cluster
    { source: 'node_0',  target: 'node_4',  value: 0.7 }, // Anxiety → Fear
    { source: 'node_0',  target: 'node_16', value: 0.7 }, // Anxiety → Rumination
    { source: 'node_0',  target: 'node_21', value: 0.7 }, // Anxiety → Stress
    { source: 'node_1',  target: 'node_3',  value: 0.7 }, // Depression → Grief
    { source: 'node_1',  target: 'node_16', value: 0.7 }, // Depression → Rumination
    { source: 'node_1',  target: 'node_2',  value: 0.5 }, // Depression → Burnout
    { source: 'node_2',  target: 'node_21', value: 0.7 }, // Burnout → Stress
    { source: 'node_2',  target: 'node_18', value: 0.6 }, // Burnout → Boundaries
    { source: 'node_3',  target: 'node_4',  value: 0.5 }, // Grief → Fear

    // Poetic cluster
    { source: 'node_5',  target: 'node_7',  value: 0.7 }, // Solitude → Stillness
    { source: 'node_5',  target: 'node_3',  value: 0.6 }, // Solitude → Grief
    { source: 'node_5',  target: 'node_20', value: 0.5 }, // Solitude → Sleep
    { source: 'node_6',  target: 'node_15', value: 0.8 }, // Longing → Hope
    { source: 'node_6',  target: 'node_3',  value: 0.6 }, // Longing → Grief
    { source: 'node_6',  target: 'node_0',  value: 0.5 }, // Longing → Anxiety
    { source: 'node_7',  target: 'node_17', value: 0.6 }, // Stillness → Self-Care
    { source: 'node_7',  target: 'node_20', value: 0.6 }, // Stillness → Sleep
    { source: 'node_8',  target: 'node_1',  value: 0.7 }, // Melancholy → Depression
    { source: 'node_8',  target: 'node_16', value: 0.6 }, // Melancholy → Rumination
    { source: 'node_8',  target: 'node_12', value: 0.5 }, // Melancholy → Vulnerability

    // Concepts cluster
    { source: 'node_9',  target: 'node_10', value: 0.7 }, // Trauma → Attachment
    { source: 'node_9',  target: 'node_4',  value: 0.6 }, // Trauma → Fear
    { source: 'node_10', target: 'node_13', value: 0.7 }, // Attachment → Empathy
    { source: 'node_10', target: 'node_12', value: 0.6 }, // Attachment → Vulnerability
    { source: 'node_11', target: 'node_15', value: 0.7 }, // Resilience → Hope
    { source: 'node_11', target: 'node_19', value: 0.6 }, // Resilience → Coping
    { source: 'node_11', target: 'node_12', value: 0.5 }, // Resilience → Vulnerability

    // Emotional states cluster
    { source: 'node_13', target: 'node_14', value: 0.8 }, // Empathy → Compassion
    { source: 'node_14', target: 'node_15', value: 0.6 }, // Compassion → Hope
    { source: 'node_12', target: 'node_14', value: 0.5 }, // Vulnerability → Compassion

    // Wellbeing cluster
    { source: 'node_17', target: 'node_18', value: 0.7 }, // Self-Care → Boundaries
    { source: 'node_17', target: 'node_20', value: 0.7 }, // Self-Care → Sleep
    { source: 'node_19', target: 'node_21', value: 0.5 }, // Coping → Stress
    { source: 'node_20', target: 'node_21', value: 0.6 }, // Sleep → Stress
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
