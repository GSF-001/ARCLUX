interface OverviewPageProps {
  params: Promise<{ org: string; repo: string }>;
}

export default async function OverviewPage({ params }: OverviewPageProps) {
  const { org, repo } = await params;

  return (
    <div className="p-8 text-neutral-200">
      <h1 className="text-xl font-semibold">
        {org}/{repo}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        Overview page — coming soon. See{" "}
        <a href={`/${org}/${repo}/graph`} className="text-blue-400 underline">
          the graph view
        </a>{" "}
        for now.
      </p>
    </div>
  );
}
