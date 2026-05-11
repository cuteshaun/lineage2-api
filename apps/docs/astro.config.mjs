// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.l2api.dev',
  integrations: [
    starlight({
      title: 'Lineage 2 API',
      description:
        'Documentation for the Lineage 2 read-only HTTP API — items, NPCs, monsters, drops, quests, classes, and more.',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/cuteshaun/lineage2-api',
        },
      ],
      sidebar: [
        { label: 'Introduction', slug: '' },
        { label: 'Getting Started', slug: 'getting-started' },
        { label: 'Core Concepts', slug: 'core-concepts' },
        { label: 'Response Format', slug: 'response-format' },
        { label: 'Endpoints', slug: 'endpoints' },
        { label: 'Limitations', slug: 'limitations' },
      ],
      customCss: [],
      head: [],
    }),
  ],
});
