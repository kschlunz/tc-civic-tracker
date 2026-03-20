import type { Metadata } from "next";
import { Newsreader, Manrope } from "next/font/google";
import Link from "next/link";
import { MeetingsProvider } from "@/lib/meetings-context";
import NavLinks from "@/components/NavLinks";
import MobileMenu from "@/components/MobileMenu";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Civic Ledger — Transylvania County Commissioner Tracker",
  description: "A civic accountability ledger tracking Transylvania County Commissioner activity across meetings, votes, and public statements",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${newsreader.variable} ${manrope.variable} h-full antialiased`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-body bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed">
        {/* Top Nav */}
        <header className="fixed top-0 w-full z-50 bg-surface/95 backdrop-blur-[20px]">
          <div className="flex justify-between items-center px-4 md:px-6 lg:px-12 py-3 md:py-4 max-w-screen-2xl mx-auto">
            <div className="flex items-center gap-4 md:gap-8">
              <Link href="/" className="flex flex-col">
                <span className="text-xl md:text-2xl font-bold italic text-primary font-headline">Civic Ledger</span>
                <span className="text-[9px] md:text-[10px] text-secondary font-bold tracking-widest uppercase hidden sm:block">Transylvania County · Informed Arbiter Edition</span>
              </Link>
              <nav className="hidden md:flex gap-6 items-center">
                <NavLinks />
              </nav>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors hidden md:block">settings</span>
              <MobileMenu />
            </div>
          </div>
          <div className="h-px w-full bg-surface-container-low" />
        </header>

        <MeetingsProvider>
          <main className="flex-1 min-h-screen pt-[57px] md:pt-[65px]">
            {children}
          </main>
        </MeetingsProvider>

        {/* Disclaimer Footer */}
        <footer className="border-t border-outline-variant/20 py-6 md:py-8 px-4 md:px-6 lg:px-12">
          <div className="max-w-screen-2xl mx-auto">
            <p className="text-[10px] md:text-[11px] text-on-surface-variant/60 leading-relaxed max-w-3xl">
              Meeting data is extracted from official Transylvania County meeting minutes using AI-assisted processing and reviewed by volunteers.
              For the official record, refer to the county&apos;s published minutes at{" "}
              <a
                href="https://www.transylvaniacounty.org/meetings"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary transition-colors"
              >
                transylvaniacounty.org/meetings
              </a>.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
