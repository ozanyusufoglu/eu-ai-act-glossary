import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { siteDescription, siteName, siteTitle, siteUrl } from "@/lib/site";
import GraphClient from "@/components/GraphClient";
import { GraphProvider } from "@/components/GraphContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Site-wide defaults. Each page adds its own title, canonical URL and share text
// through pageMetadata() in src/lib/site.ts.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: `%s | ${siteName}` },
  description: siteDescription,
  applicationName: siteName,
  keywords: ["EU AI Act", "GDPR", "Shadow AI", "AI governance", "compliance glossary", "data loss prevention", "3D graph"],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* The graph lives in the layout so WebGL stays mounted while pages change beneath it. */}
        <GraphProvider>
          <main className="relative w-screen h-screen overflow-hidden" style={{ background: "#eaeaec" }}>
            <GraphClient />
            {children}
          </main>
        </GraphProvider>
        <Analytics />
      </body>
    </html>
  );
}
