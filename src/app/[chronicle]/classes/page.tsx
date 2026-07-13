import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetchList } from "@/lib/api/client";
import type { ClassListDto } from "@/lib/api/dto/class";

/**
 * Race rendering order — matches the L2 client's race ordering.
 * Dwarf only has a Fighter base (no Mystic), so the right column for
 * Dwarf is intentionally empty.
 */
const RACE_ORDER = ["Human", "Elf", "Dark Elf", "Orc", "Dwarf"] as const;

// On-demand ISR: generated on first request, cached until the next
// deploy (see lib/api/client.ts).
export async function generateStaticParams() {
  return [];
}

export default async function ClassesPage({
  params,
}: {
  params: Promise<{ chronicle: string }>;
}) {
  const { chronicle } = await params;
  if (!isChronicle(chronicle)) notFound();

  const result = await apiFetchList<ClassListDto>(`/api/${chronicle}/classes`);
  // Throw on failure: under ISR a rendered error block would be cached
  // until the next deploy; a failed generation is not cached and retried.
  if (!result.ok) throw new Error(result.error);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Classes
        </h1>
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {result.meta.total.toLocaleString()} total
        </span>
      </header>

      <Tree chronicle={chronicle} classes={result.data} />
    </div>
  );
}

function Tree({
  chronicle,
  classes,
}: {
  chronicle: string;
  classes: ClassListDto[];
}) {
  // parentId -> children, indexed once for O(1) child lookup.
  const childrenByParent = new Map<number, ClassListDto[]>();
  for (const c of classes) {
    if (c.parentClassId === null) continue;
    let list = childrenByParent.get(c.parentClassId);
    if (!list) {
      list = [];
      childrenByParent.set(c.parentClassId, list);
    }
    list.push(c);
  }
  // Stable child order: by id.
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.id - b.id);
  }

  // Race -> [base classes], in declaration order from the API.
  const basesByRace = new Map<string, ClassListDto[]>();
  for (const c of classes) {
    if (c.parentClassId !== null) continue;
    let list = basesByRace.get(c.race);
    if (!list) {
      list = [];
      basesByRace.set(c.race, list);
    }
    list.push(c);
  }

  return (
    <div className="flex flex-col gap-8">
      {RACE_ORDER.map((race) => {
        const bases = basesByRace.get(race) ?? [];
        if (bases.length === 0) return null;
        return (
          <section
            key={race}
            className="flex flex-col gap-3 rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              {race}
            </h2>
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
              {bases.map((base) => (
                <BaseColumn
                  key={base.id}
                  chronicle={chronicle}
                  base={base}
                  childrenByParent={childrenByParent}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BaseColumn({
  chronicle,
  base,
  childrenByParent,
}: {
  chronicle: string;
  base: ClassListDto;
  childrenByParent: Map<number, ClassListDto[]>;
}) {
  const firstProfs = childrenByParent.get(base.id) ?? [];
  return (
    <div className="flex flex-col gap-3">
      <ClassLink
        chronicle={chronicle}
        cls={base}
        className="text-base font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
      />
      <div className="flex flex-col gap-3 pl-4">
        {firstProfs.map((prof) => (
          <FirstProfBlock
            key={prof.id}
            chronicle={chronicle}
            prof={prof}
            childrenByParent={childrenByParent}
          />
        ))}
      </div>
    </div>
  );
}

function FirstProfBlock({
  chronicle,
  prof,
  childrenByParent,
}: {
  chronicle: string;
  prof: ClassListDto;
  childrenByParent: Map<number, ClassListDto[]>;
}) {
  const secondProfs = childrenByParent.get(prof.id) ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      <ClassLink
        chronicle={chronicle}
        cls={prof}
        className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
      />
      <ul className="flex flex-col gap-1 pl-4">
        {secondProfs.map((sp) => (
          <SecondProfRow
            key={sp.id}
            chronicle={chronicle}
            second={sp}
            childrenByParent={childrenByParent}
          />
        ))}
      </ul>
    </div>
  );
}

function SecondProfRow({
  chronicle,
  second,
  childrenByParent,
}: {
  chronicle: string;
  second: ClassListDto;
  childrenByParent: Map<number, ClassListDto[]>;
}) {
  // Interlude allows at most one 3rd-prof per 2nd-prof, but render any
  // additional ones defensively just in case the data drifts.
  const thirds = childrenByParent.get(second.id) ?? [];
  return (
    <li className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
      <span className="text-zinc-400 dark:text-zinc-500">•</span>
      <ClassLink
        chronicle={chronicle}
        cls={second}
        className="hover:underline"
      />
      {thirds.map((third) => (
        <span key={third.id} className="flex items-center gap-1.5">
          <span className="text-zinc-400 dark:text-zinc-500">→</span>
          <ClassLink
            chronicle={chronicle}
            cls={third}
            className="hover:underline"
          />
        </span>
      ))}
    </li>
  );
}

function ClassLink({
  chronicle,
  cls,
  className,
}: {
  chronicle: string;
  cls: ClassListDto;
  className?: string;
}) {
  return (
    <Link href={`/${chronicle}/classes/${cls.id}`} className={className}>
      {cls.name}
    </Link>
  );
}
