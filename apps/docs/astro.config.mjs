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
            { label: 'Response Format', slug: 'response-format' },
          ],
        },
        {
          label: 'Understanding the API',
          items: [
            { label: 'Core Concepts', slug: 'core-concepts' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'All Endpoints', slug: 'endpoints' },
            { label: 'OpenAPI Spec', link: 'https://l2api.dev/api/openapi.json' },
          ],
        },
        {
          label: 'More Info',
          items: [
            { label: 'Limitations', slug: 'limitations' },
            { label: 'Local Development', slug: 'local-development' },
          ],
        },
      ],
      customCss: [],
      head: [],
    }),
  ],
});
