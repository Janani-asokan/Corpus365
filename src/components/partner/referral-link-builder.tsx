"use client";

import { useId, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { Select } from "@/components/ui/field";

/** Builds a personal link for the marketplace or for one product. */
export function ReferralLinkBuilder({ baseUrl, products }: { baseUrl: string; products: { slug: string; name: string }[] }) {
  const id = useId();
  const [slug, setSlug] = useState("");
  const link = slug ? `${baseUrl}?to=${encodeURIComponent(slug)}` : baseUrl;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium">Link to</label>
        <Select id={id} value={slug} onChange={(e) => setSlug(e.target.value)}>
          <option value="">The whole marketplace</option>
          {products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </Select>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-white p-2 pl-3">
        <code className="min-w-0 flex-1 truncate text-sm">{link}</code>
        <CopyButton value={link} />
      </div>
      <a
        className="inline-block text-sm font-medium text-brand hover:underline"
        href={`https://wa.me/?text=${encodeURIComponent(`Try Corpus365 business software free: ${link}`)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Share on WhatsApp →
      </a>
    </div>
  );
}
