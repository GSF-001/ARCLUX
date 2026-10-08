import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const FEATURES = [
  {
    title: 'Dependency graph',
    text: 'Imports, exports, folders and a cross-file call graph — rendered as an interactive 3D graph you can actually navigate.',
    to: '/architecture',
    tag: 'graph',
  },
  {
    title: 'Blast radius',
    text: 'Ask what breaks before you edit. Impact tracing follows every consumer of a file, module or export.',
    to: '/how-to-use',
    tag: 'impact',
  },
  {
    title: '20 structural detectors',
    text: 'Circular deps, dead code, orphan files, duplicate modules, layer violations — one command: arclux doctor.',
    to: '/deep-dive',
    tag: 'doctor',
  },
  {
    title: '14 framework rules',
    text: 'Next.js, NestJS, Express, Vite, Electron, React and Laravel conventions, gated by arclux verify.',
    to: '/guides',
    tag: 'verify',
  },
  {
    title: 'Scripting DSL',
    text: 'Chain analyze, impact, doctor, security and graph in plain-text scripts. Reuse them as CI checks.',
    to: '/usage',
    tag: 'script',
  },
  {
    title: 'MCP for AI agents',
    text: '30+ tools over Model Context Protocol with self-triggering workflow instructions for Claude, Cursor and friends.',
    to: '/skill',
    tag: 'mcp',
  },
];

const LAYERS = [
  {
    name: 'Intelligence',
    status: 'verified',
    text: 'Parser for 27 languages, indexer, graph, detectors, rules, impact, search, security, DSL and MCP — verified against real repos: vscode, react, vite, laravel, flask.',
    to: '/architecture',
  },
  {
    name: 'Platform',
    status: 'wired',
    text: 'Kernel with signal bus, process manager, job scheduler, services, storage, networking, notifications, daemon, watcher and content-hash caches underneath.',
    to: '/stack',
  },
];

function CodeLine({ children }) {
  return (
    <div className={styles.codeLine}>
      <span className={styles.codeDollar}>$</span>
      <code>{children}</code>
      <span className={styles.codeCursor} aria-hidden="true" />
    </div>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout title={siteConfig.tagline} description={siteConfig.tagline}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className="container">
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            Open source · Apache 2.0 · v0.3 on npm
          </span>

          <Heading as="h1" className={styles.title}>
            See through your codebase
            <br />
            <em>before it breaks.</em>
          </Heading>

          <p className={styles.lede}>
            Every repository accumulates debt nobody can see until it is too late — circular dependencies,
            dead code, files nobody remembers touching. ARCLUX builds a live dependency graph, traces the blast
            radius of every change, and catches structural rot before it ships.
          </p>

          <div className={styles.actions}>
            <Link className={clsx('button', 'button--primary', styles.ctaPrimary)} to="/quickstart">
              Get started
            </Link>
            <Link className={clsx('button', 'button--secondary', styles.ctaGhost)} to="/tutorial">
              Read the tutorial
            </Link>
          </div>

          <CodeLine>npx arclux analyze .</CodeLine>

          <p className={styles.heroMeta}>
            Zero setup · ships every tree-sitter grammar · Node 20+ · works in Termux
          </p>
        </div>
      </header>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHead}>
            <Heading as="h2">Everything the graph knows</Heading>
            <p>Static analysis that answers questions instead of dumping files at you.</p>
          </div>

          <div className={styles.grid}>
            {FEATURES.map((f) => (
              <Link key={f.title} className={styles.card} to={f.to}>
                <span className={styles.cardTag}>{f.tag}</span>
                <Heading as="h3">{f.title}</Heading>
                <p>{f.text}</p>
                <span className={styles.cardCta}>Read more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={clsx(styles.section, styles.sectionAlt)}>
        <div className="container">
          <div className={styles.sectionHead}>
            <Heading as="h2">Two layers, one platform</Heading>
            <p>Codebase intelligence is the first application of the platform — not the last.</p>
          </div>

          <div className={styles.layers}>
            {LAYERS.map((l) => (
              <Link key={l.name} className={styles.layer} to={l.to}>
                <div className={styles.layerTop}>
                  <Heading as="h3">{l.name}</Heading>
                  <span className={styles[`status_${l.status}`] || styles.status_wired}>{l.status}</span>
                </div>
                <p>{l.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.split}>
            <div>
              <Heading as="h2">Ship it as a gate, not a lecture</Heading>
              <p>
                Run <code>arclux doctor</code> in CI, gate merges on <code>arclux verify</code>, or write a{' '}
                <code>.arclux</code> script that runs the whole audit on every pull request. Everything is also
                exposed over MCP, so an agent picks the right tool without being told twice.
              </p>
              <div className={styles.actions}>
                <Link className={clsx('button', 'button--primary')} to="/guides">
                  Guides
                </Link>
                <Link className={clsx('button', 'button--outline')} to="/examples">
                  Real examples
                </Link>
              </div>
            </div>
            <pre className={styles.snippet}>
              <code>{`# .github/workflows/audit.yml
- run: npx arclux doctor .
- run: npx arclux verify .
- run: npx arclux script audit.arclux`}</code>
            </pre>
          </div>
        </div>
      </section>
    </Layout>
  );
}
