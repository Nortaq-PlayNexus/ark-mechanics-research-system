"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const SECTIONS: { group: string; items: { href: string; label: string; code: string }[] }[] = [
  {
    group: "Command",
    items: [
      { href: "/", label: "Command Centre", code: "00" },
      { href: "/agents", label: "Research Agent Control", code: "01" },
      { href: "/experiments", label: "Experiment Manager", code: "02" },
    ],
  },
  {
    group: "Knowledge",
    items: [
      { href: "/creatures", label: "Creature Encyclopedia", code: "03" },
      { href: "/combinations", label: "Combination Explorer", code: "04" },
      { href: "/buffs", label: "Buff Interaction Lab", code: "05" },
      { href: "/mechanics", label: "Undiscovered Mechanics", code: "06" },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/raid", label: "Raid Intelligence", code: "07" },
      { href: "/pvp", label: "PvP Research", code: "08" },
      { href: "/pve", label: "PvE & Boss Research", code: "09" },
      { href: "/breeding", label: "Breeding & Mutations", code: "10" },
    ],
  },
  {
    group: "Publication",
    items: [
      { href: "/discoveries", label: "Discovery Database", code: "11" },
      { href: "/sources", label: "Evidence & Sources", code: "12" },
      { href: "/reports", label: "Research Reports", code: "13" },
      { href: "/settings", label: "Settings & Data", code: "14" },
    ],
  },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed z-40 h-screen w-72 shrink-0 overflow-y-auto border-r border-edge bg-panel/95 backdrop-blur transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-edge p-4">
          <Link href="/" className="block" onClick={() => setOpen(false)}>
            <div className="data-font text-[10px] uppercase tracking-[0.3em] text-tactical">Autonomous Research Division</div>
            <div className="mt-1 text-lg font-semibold tracking-wide text-white">ARK OMNISCIENCE</div>
            <div className="mt-1 text-[11px] leading-tight text-slate-500">
              Creature synergy · combat mechanics · undiscovered strategy
            </div>
          </Link>
        </div>
        <nav className="p-3 pb-16">
          {SECTIONS.map((section) => (
            <div key={section.group} className="mb-4">
              <div className="data-font mb-2 px-2 text-[10px] uppercase tracking-[0.25em] text-slate-600">{section.group}</div>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition ${
                          active
                            ? "border-tactical/40 bg-tactical/10 text-tactical glow-tactical"
                            : "border-transparent text-slate-400 hover:border-edge hover:bg-panel-2 hover:text-slate-200"
                        }`}
                      >
                        <span className="data-font text-[10px] text-slate-600">{item.code}</span>
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-edge bg-void/90 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded border border-edge px-2 py-1 text-xs text-slate-400 lg:hidden"
          >
            Menu
          </button>
          <div className="flex items-center gap-2">
            <span className="live-dot h-2 w-2 rounded-full bg-tactical" />
            <span className="data-font text-[11px] uppercase tracking-[0.2em] text-tactical">Research systems online</span>
          </div>
          <div className="ml-auto hidden items-center gap-4 sm:flex">
            <span className="data-font text-[10px] uppercase tracking-[0.2em] text-slate-600">12 agents</span>
            <span className="data-font text-[10px] uppercase tracking-[0.2em] text-amber">Discovery watch</span>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
        <footer className="border-t border-edge px-4 py-3 text-[11px] text-slate-600">
          ARK Omniscience research platform · all findings are evidence-graded · no experimental result is fabricated
        </footer>
      </div>
    </div>
  );
}
