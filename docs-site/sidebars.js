/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    {
      type: 'doc',
      id: 'overview',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: ['quickstart', 'usage', 'how-to-use', 'tutorial', 'skill'],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: false,
      items: ['about', 'architecture', 'stack', 'status', 'gotchas'],
    },
    {
      type: 'category',
      label: 'Learn',
      items: ['guides', 'deep-dive', 'examples'],
    },
    {
      type: 'doc',
      id: 'changelog',
      label: 'Changelog',
    },
  ],
};

module.exports = sidebars;
