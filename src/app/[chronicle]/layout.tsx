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
      <footer className="border-t border-zinc-200 bg-white px-6 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-black dark:text-zinc-400">
        Unofficial project. Not affiliated with NCSoft.
      </footer>
    </div>
  );
}
