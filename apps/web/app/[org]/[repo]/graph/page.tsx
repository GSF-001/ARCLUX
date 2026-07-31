import { GraphProvider } from "@/components/graph/GraphProvider";
import { GraphCanvas } from "@/components/graph/GraphCanvas";

interface GraphPageProps {
  params: Promise<{ org: string; repo: string }>;
}

export default async function GraphPage({ params }: GraphPageProps) {
  const { org, repo } = await params;
  const repoUrl = `https://github.com/${org}/${repo}.git`;

  return (
    <div className="h-screen w-full">
      <GraphProvider repoUrl={repoUrl}>
        <GraphCanvas />
      </GraphProvider>
    </div>
  );
}
