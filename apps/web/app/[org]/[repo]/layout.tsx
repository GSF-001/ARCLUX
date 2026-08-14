// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Shared shell for every /[org]/[repo]/* page: Navbar + Sidebar +
// Breadcrumbs (components/layout/WorkspaceLayout.tsx). Previously the
// repo pages rendered standalone full-screen with no app chrome — the
// workspace components (WorkspaceLayout, Navbar, Sidebar) existed but
// were never mounted (see status-web.md).

import { WorkspaceLayout } from "@/components/layout/WorkspaceLayout";
import type { BreadcrumbItem } from "@/components/layout/Breadcrumbs";

interface RepoLayoutProps {
  children: React.ReactNode;
  params: Promise<{ org: string; repo: string }>;
}

export default async function RepoLayout({ children, params }: RepoLayoutProps) {
  const { org, repo } = await params;
  const base = `/${org}/${repo}`;

  const breadcrumbs: BreadcrumbItem[] = [
    { label: `${org}/${repo}`, href: base },
  ];

  return (
    <WorkspaceLayout org={org} repo={repo} breadcrumbs={breadcrumbs}>
      {children}
    </WorkspaceLayout>
  );
}
