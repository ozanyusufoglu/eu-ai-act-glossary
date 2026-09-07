'use client';

import dynamic from 'next/dynamic';

const Graph3D = dynamic(() => import('@/components/Graph3D'), { ssr: false });

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden" style={{ background: '#e8e8ea' }}>
      <Graph3D />

      {/* Top-left wordmark */}
      <div className="absolute top-6 left-8 z-10 pointer-events-none">
        <p className="text-xs font-semibold tracking-widest text-black/30">Emotions in motion</p>
      </div>
    </main>
  );
}
