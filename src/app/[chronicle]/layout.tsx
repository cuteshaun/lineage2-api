import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { ChronicleNav } from "@/components/explorer/ChronicleNav";

export default async function ChronicleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ chronicle: string }>;
}) {
  const { chronicle } = await params;
  if (!isChronicle(chronicle)) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <ChronicleNav chronicle={chronicle} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-4 text-xs text-zinc-500 sm:flex-row sm:justify-between dark:text-zinc-400">
          <span className="font-mono uppercase tracking-widest">
            Data Explorer preview
          </span>
          <nav className="flex gap-4">
            <a
              href="https://l2api.dev/"
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Main site
            </a>
            <a
              href="https://docs.l2api.dev/"
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Docs
            </a>
            <a
              href="https://github.com/cuteshaun/lineage2-api"
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              GitHub
            </a>
          </nav>
          <span>Unofficial project. Not affiliated with NCSoft.</span>
        </div>
      </footer>
    </div>
  );
}
