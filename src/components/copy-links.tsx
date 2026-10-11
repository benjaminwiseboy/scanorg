"use client";

import { useState } from "react";

export function CopyLinks({ links }: { links: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Un lien = une personne. Les liens ne sont pas nominatifs.</p>
        <button
          className="btn-ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(links.join("\n"));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copié ✓" : `Copier les ${links.length} liens`}
        </button>
      </div>
      <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-lg bg-surface-2 p-3 font-mono text-xs">
        {links.map((l) => (
          <li key={l} className="truncate">{l}</li>
        ))}
      </ul>
    </div>
  );
}
