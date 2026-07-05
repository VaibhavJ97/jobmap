"use client";

import { useState } from "react";

const LINKS = [
  { href: "https://vaibhavj97.vercel.app", label: "Home" },
  { href: "https://vaibhavj97-thesis.vercel.app", label: "Master Thesis" },
  { href: "https://vaibhavj97-geochat.vercel.app", label: "GeoChat" },
  { href: "https://vaibhavj97-bhe.vercel.app", label: "BHE Recommender" },
  { href: "https://vaibhavj97-jobmap.vercel.app", label: "JobMap", active: true },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="nav-inner">
        <a className="logo" href="https://vaibhavj97.vercel.app">
          Vaibhav <span className="logo-accent">Jaiswal</span>
        </a>
        <nav id="primary-nav" className={open ? "open" : ""}>
          <ul>
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className={l.active ? "active" : ""} onClick={() => setOpen(false)}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <button
          className="nav-toggle"
          aria-label="Open menu"
          aria-controls="primary-nav"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <a
          href="https://github.com/VaibhavJ97"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-github"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
          <span>GitHub</span>
        </a>
      </div>
    </header>
  );
}
