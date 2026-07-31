"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewRepoPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function parseOrgAndName(url: string): { org: string; repo: string } | null {
    const cleaned = url.trim().replace(/\.git$/, "");
    const match = cleaned.match(/[:/]([^/]+)\/([^/]+)$/);
    if (!match) return null;
    return { org: match[1], repo: match[2] };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parseOrgAndName(repoUrl);
    if (!parsed) {
      setError("Couldn't parse an org/repo name from that URL.");
      return;
    }

    setIsSubmitting(true);
    router.push(`/${parsed.org}/${parsed.repo}/graph`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <h1 className="text-lg font-semibold text-neutral-100">Connect a repository</h1>
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/org/repo"
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-blue-500"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting || !repoUrl.trim()}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {isSubmitting ? "Loading…" : "Analyze repository"}
        </button>
      </form>
    </div>
  );
}
