import Link from "next/link";
import { adjacency, LAW_COLORS, LAW_NAMES, termById, termPath, topicName } from "@/lib/graphData";

/**
 * Everything the panel says about one term. A Server Component: the definition,
 * source, "often confused" notes and links to connected terms are plain HTML.
 */
export default function TermArticle({ id, heading: Heading }: { id: string; heading: "h1" | "h2" }) {
  const term = termById.get(id)!;
  const neighbors = adjacency.get(id)!;
  const contrasts = neighbors.filter(n => n.type === "contrasts");
  const related = neighbors
    .filter(n => n.type === "related")
    .map(n => termById.get(n.id)!)
    .sort((a, b) => a.name.localeCompare(b.name));
  const Sub = Heading === "h1" ? "h2" : "h3";

  return (
    <>
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-black/40 mb-3">{topicName.get(term.topic)}</p>
        <Heading className="text-3xl font-bold text-black leading-tight tracking-tight pr-6">{term.name}</Heading>
        {term.abbreviations.length > 0 && (
          <p className="mt-2 font-mono text-sm text-black/50">{term.abbreviations.join(" · ")}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px]"
            style={{ color: LAW_COLORS[term.law], background: `${LAW_COLORS[term.law]}14` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: LAW_COLORS[term.law] }} />
            {LAW_NAMES[term.law]}
          </span>
          {term.source && (
            <span className="font-mono text-[11px] text-black/60 border-l-2 border-black/20 pl-2">{term.source}</span>
          )}
        </div>
      </div>

      <p className="text-[15px] leading-relaxed text-black/80">{term.definition}</p>

      {contrasts.length > 0 && (
        <section>
          <Sub className="text-[10px] uppercase tracking-[0.2em] text-black/40 mb-3">Often confused with</Sub>
          <div className="flex flex-col gap-3">
            {contrasts.map(c => (
              <div key={c.id} className="rounded-lg border border-dashed p-3" style={{ borderColor: LAW_COLORS.both }}>
                <TermLink id={c.id} />
                <p className="mt-2 text-sm leading-relaxed text-black/70">{c.note}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section>
          <Sub className="text-[10px] uppercase tracking-[0.2em] text-black/40 mb-3">
            Connected terms · {related.length}
          </Sub>
          <div className="flex flex-wrap gap-2">
            {related.map(t => <TermLink key={t.id} id={t.id} />)}
          </div>
        </section>
      )}
    </>
  );
}

function TermLink({ id }: { id: string }) {
  const t = termById.get(id)!;
  return (
    <Link
      href={termPath(id)}
      scroll={false}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/15 text-xs text-black/70 bg-white/60 hover:border-black/40 hover:text-black"
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: LAW_COLORS[t.law] }} />
      {t.name}
    </Link>
  );
}
