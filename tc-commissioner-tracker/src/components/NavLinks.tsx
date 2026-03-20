"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/commissioners", label: "Commissioners" },
  { href: "/topics", label: "Topics", matchPrefix: "/topics" },
  { href: "/follow-ups", label: "Follow-ups" },
  { href: "/meetings", label: "Meetings" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = item.matchPrefix
          ? pathname.startsWith(item.matchPrefix)
          : pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href === "/topics" ? "/topics/fiscal" : item.href}
            className={`font-label text-sm tracking-tight transition-all duration-300 ${
              active
                ? "text-primary font-semibold border-b-2 border-primary pb-1"
                : "text-secondary hover:text-primary"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
