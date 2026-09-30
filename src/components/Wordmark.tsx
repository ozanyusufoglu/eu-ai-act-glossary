import Link from "next/link";
import { siteName } from "@/lib/site";

/** Top-left site name. The page's <h1> on the home page; a link home everywhere else. */
export default function Wordmark({ heading = false }: { heading?: boolean }) {
  const className = "text-xs font-semibold tracking-widest text-black/40";
  return (
    <div className="absolute top-6 left-4 sm:left-8 z-10">
      {heading ? (
        <h1 className={`${className} pointer-events-none`}>{siteName}</h1>
      ) : (
        <p className={className}>
          <Link href="/" scroll={false} className="hover:text-black/70">
            {siteName}
          </Link>
        </p>
      )}
    </div>
  );
}
