"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/commissioners", label: "Commissioners", icon: "groups" },
  { href: "/topics/fiscal", label: "Topics", icon: "topic", matchPrefix: "/topics" },
  { href: "/follow-ups", label: "Follow-ups", icon: "checklist" },
  { href: "/meetings", label: "Meetings", icon: "event" },
];

function MenuOverlay({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-surface flex flex-col">
      {/* Header area with close button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20">
        <span className="text-xl font-bold italic text-primary font-headline">Civic Ledger</span>
        <button
          onClick={onClose}
          className="p-2 text-primary hover:bg-surface-container-high rounded-lg"
          aria-label="Close menu"
        >
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col p-4 space-y-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const active = item.matchPrefix
            ? pathname.startsWith(item.matchPrefix)
            : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-4 px-5 py-4 rounded-lg text-lg font-label transition-colors ${
                active
                  ? "bg-primary text-on-primary font-bold"
                  : "text-on-surface hover:bg-surface-container-high"
              }`}
            >
              <span className="material-symbols-outlined text-2xl">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>,
    document.body,
  );
}

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 -mr-2 text-primary hover:bg-surface-container-high rounded-lg transition-colors"
        aria-label="Toggle menu"
      >
        <span className="material-symbols-outlined text-2xl">menu</span>
      </button>

      {mounted && open && <MenuOverlay onClose={() => setOpen(false)} />}
    </div>
  );
}
