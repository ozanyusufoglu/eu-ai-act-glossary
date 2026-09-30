import type { Metadata } from 'next';
import Link from 'next/link';
import PanelFrame from '@/components/PanelFrame';
import Wordmark from '@/components/Wordmark';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <>
      <Wordmark />
      <PanelFrame label="Page not found">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-black/40 mb-3">404</p>
          <h1 className="text-3xl font-bold text-black leading-tight tracking-tight pr-6">Page not found</h1>
        </div>
        <p className="text-[15px] leading-relaxed text-black/80">
          There is no term at this address. Search for it above, click a node in the graph, or{' '}
          <Link href="/" scroll={false} className="underline underline-offset-2">
            start from the EU AI Act
          </Link>
          .
        </p>
      </PanelFrame>
    </>
  );
}
