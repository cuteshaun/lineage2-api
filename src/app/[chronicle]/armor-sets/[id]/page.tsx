import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch } from "@/lib/api/client";
import { ArmorSetCard } from "@/components/explorer/ArmorSetCard";
import type { ArmorSetDetailDto } from "@/lib/api/dto/armor-set";

export default async function ArmorSetDetailsPage({
  params,
}: {
  params: Promise<{ chronicle: string; id: string }>;
}) {
  const { chronicle, id } = await params;
  if (!isChronicle(chronicle)) notFound();

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const result = await apiFetch<ArmorSetDetailDto>(
    `/api/${chronicle}/armor-sets/${numericId}`
  );

  if (!result.ok) {
    if (result.status === 404) notFound();
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {(result as { error?: string }).error ?? "Failed to load armor set"}
      </div>
    );
  }

  const set = result.data;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${chronicle}/armor-sets`}
        className="font-mono text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All armor sets
      </Link>

      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          armor set · #{set.id}
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
          {set.name}
        </h1>
      </header>

      <ArmorSetCard chronicle={chronicle} set={set} />
    </div>
  );
}
