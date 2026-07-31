interface SettingsPageProps {
  params: Promise<{ org: string; repo: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { org, repo } = await params;

  return (
    <div className="p-8 text-neutral-200">
      <h1 className="text-lg font-semibold">
        Settings — {org}/{repo}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        Repository settings coming soon.
      </p>
    </div>
  );
}
