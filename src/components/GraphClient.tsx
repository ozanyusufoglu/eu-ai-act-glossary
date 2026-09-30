'use client';

import dynamic from 'next/dynamic';

// WebGL needs the browser, so the graph is client-only. `ssr: false` is not
// allowed in Server Components, hence this thin wrapper.
const Graph3D = dynamic(() => import('@/components/Graph3D'), { ssr: false });

export default function GraphClient() {
  return <Graph3D />;
}
