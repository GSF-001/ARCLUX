// @ts-check
const { themes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'ARCLUX',
  tagline: 'See through your codebase before it breaks',
  favicon: 'img/favicon.svg',

  url: 'https://gsf-001.github.io',
  baseUrl: '/ARCLUX/',

  organizationName: 'GSF-001',
  projectName: 'ARCLUX',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'id',
    locales: ['id'],
  },

  stylesheets: [
    {
      href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
      rel: 'stylesheet',
    },
  ],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/GSF-001/ARCLUX/edit/ARCLUX.main/docs-site/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'map',
        path: 'map',
        routeBasePath: 'map',
        sidebarPath: require.resolve('./sidebars-map.js'),
        editUrl: 'https://github.com/GSF-001/ARCLUX/edit/ARCLUX.main/docs-site/',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'progres',
        path: 'progres',
        routeBasePath: 'progres',
        sidebarPath: require.resolve('./sidebars-progres.js'),
        editUrl: 'https://github.com/GSF-001/ARCLUX/edit/ARCLUX.main/docs-site/',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'blueprint',
        path: 'blueprint',
        routeBasePath: 'blueprint',
        sidebarPath: require.resolve('./sidebars-blueprint.js'),
        editUrl: 'https://github.com/GSF-001/ARCLUX/edit/ARCLUX.main/docs-site/',
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'light',
        respectPrefersColorScheme: true,
        disableSwitch: false,
      },
      metadata: [
        {
          name: 'keywords',
          content:
            'arclux, codebase analysis, dependency graph, impact analysis, static analysis, architecture detectors',
        },
      ],
      navbar: {
        title: 'ARCLUX',
        logo: {
          alt: 'ARCLUX',
          src: 'img/favicon.svg',
        },
        hideOnScroll: false,
        items: [
          {
            type: 'doc',
            docId: 'overview',
            position: 'left',
            label: 'Docs',
          },
          {
            type: 'doc',
            docsPluginId: 'map',
            docId: 'intelligence/parser',
            position: 'left',
            label: 'Codebase Map',
          },
          {
            type: 'doc',
            docsPluginId: 'blueprint',
            docId: 'index',
            position: 'left',
            label: 'Blueprint',
          },
          {
            type: 'doc',
            docsPluginId: 'progres',
            docId: 'progres-status-core',
            position: 'left',
            label: 'Progress',
          },
          {
            href: 'https://www.npmjs.com/package/arclux',
            label: 'npm',
            position: 'right',
          },
          {
            href: 'https://github.com/GSF-001/ARCLUX',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Introduction', to: '/overview' },
              { label: 'Quickstart', to: '/quickstart' },
              { label: 'Tutorial', to: '/tutorial' },
              { label: 'Architecture', to: '/architecture' },
              { label: 'Changelog', to: '/changelog' },
            ],
          },
          {
            title: 'Explore',
            items: [
              { label: 'Codebase Map', to: '/map/intelligence/parser' },
              { label: 'Progress Detail', to: '/progres/progres-status-core' },
              { label: 'Blueprint', to: '/blueprint' },
              { label: 'Gotchas', to: '/gotchas' },
            ],
          },
          {
            title: 'Project',
            items: [
              { label: 'GitHub', href: 'https://github.com/GSF-001/ARCLUX' },
              { label: 'npm', href: 'https://www.npmjs.com/package/arclux' },
              {
                label: 'Issues',
                href: 'https://github.com/GSF-001/ARCLUX/issues',
              },
              {
                label: 'Discussions',
                href: 'https://github.com/GSF-001/ARCLUX/discussions',
              },
            ],
          },
        ],
        copyright: `ARCLUX — Apache 2.0 (engine) · ARCLUX MMO License (gameserver). Copyright © ${new Date().getFullYear()}.`,
      },
      prism: {
        theme: themes.github,
        darkTheme: themes.dracula,
        additionalLanguages: ['bash', 'python', 'typescript', 'json', 'yaml', 'toml', 'diff', 'go', 'rust'],
      },
    }),
};

module.exports = config;
