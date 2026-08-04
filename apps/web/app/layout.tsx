// Copyright 2026 Mikatoshi
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Fix: root layout previously never applied the "dark" class to <html> at
// all — hooks/useTheme.ts existed and worked, but nothing in the app tree
// ever called it, so the dark theme tokens in theme/arclux.json were
// defined but dormant. This is why the landing page and graph viewer
// rendered light/white despite the project's dark-first design intent.
// Also replaces the leftover create-next-app boilerplate metadata.

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ARCLUX — Repository Intelligence Platform",
  description:
    "Map your repository into a dependency graph, flag structural issues, and trace the exact impact of any file, module, or route.",
};

const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("arclux-theme");
    if (stored === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
