// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.l2api.dev',
  integrations: [
    starlight({
      title: 'Lineage 2 API',
      description:
        'A read-only HTTP API for Lineage 2 Interlude game data — items, NPCs, monsters, drops, quests, classes, armor sets, and more.',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/cuteshaun/lineage2-api',
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Overview', slug: '' },
            { label: 'Endpoints', slug: 'endpoints' },
            { label: 'OpenAPI Spec', slug: 'openapi' },
          ],
        },
        {
          label: 'More Info',
          items: [
            { label: 'Scope', slug: 'limitations' },
            { label: 'How to Contribute', slug: 'local-development' },
          ],
        },
      ],
      customCss: ['./src/styles/docs.css'],
      head: [],
    }),
  ],
});
