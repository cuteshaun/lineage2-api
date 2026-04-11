export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8 px-8 py-24 sm:px-16">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            unofficial · interlude
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
            Lineage 2 API
          </h1>
          <p className="max-w-2xl text-lg leading-7 text-zinc-600 dark:text-zinc-400">
            A read-only HTTP API over Lineage 2 datapack content — items, NPCs,
            and drop tables. Currently backed by aCis Interlude data; the
            architecture is designed to support more chronicles later.
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Try it
          </h2>
          <ul className="flex flex-col gap-2 font-mono text-sm">
            <li>
              <a
                className="text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                href="/api/interlude/items/57"
              >
                GET /api/interlude/items/57
              </a>
            </li>
            <li>
              <a
                className="text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                href="/api/interlude/monsters?npcType=GrandBoss&sort=-level"
              >
                GET /api/interlude/monsters?npcType=GrandBoss&amp;sort=-level
              </a>
            </li>
            <li>
              <a
                className="text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                href="/api/interlude/npcs/22001/drops"
              >
                GET /api/interlude/npcs/22001/drops
              </a>
            </li>
            <li>
              <a
                className="text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                href="/api/interlude/meta/npc-types"
              >
                GET /api/interlude/meta/npc-types
              </a>
            </li>
          </ul>
        </section>

        <footer className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          Unofficial project. Not affiliated with or endorsed by NCSoft.
          Lineage and Lineage 2 are trademarks of their respective owners.
        </footer>
      </main>
    </div>
  );
}
