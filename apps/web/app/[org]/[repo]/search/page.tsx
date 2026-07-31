interface SearchPageProps {
  params: Promise<{ org: string; repo: string }>;
}

export default async function SearchPage({ params }: SearchPageProps) {
  const { org, repo } = await params;

  return (
    <div className="p-8 text-neutral-200">
      <h1 className="text-lg font-semibold">
        Search — {org}/{repo}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        Search UI coming soon — waiting on packages/search/SearchEngine.ts to be implemented.
      </p>
    </div>
  );
}
