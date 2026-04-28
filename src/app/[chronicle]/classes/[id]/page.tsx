import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch, apiFetchList } from "@/lib/api/client";
import { ItemIcon } from "@/components/explorer/ItemIcon";
import type {
  ClassDetailDto,
  ClassListDto,
  ClassSkillLearnDto,
} from "@/lib/api/dto/class";

const PROFESSION_LABELS = [
  "Base class",
  "1st profession",
  "2nd profession",
  "3rd profession",
] as const;

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ chronicle: string; id: string }>;
}) {
  const { chronicle, id } = await params;
  if (!isChronicle(chronicle)) notFound();

  const numericId = Number(id);
  // Class ids start at 0 (Human Fighter) — accept >= 0 here.
  if (!Number.isInteger(numericId) || numericId < 0) notFound();

  // Detail + list in parallel. The list is needed to resolve
  // parent/child names without per-id round-trips.
  const [detail, list] = await Promise.all([
    apiFetch<ClassDetailDto>(`/api/${chronicle}/classes/${numericId}`),
    apiFetchList<ClassListDto>(`/api/${chronicle}/classes`),
  ]);

  if (!detail.ok) {
    if (detail.status === 404) notFound();
    return (
      <ErrorBlock
        message={(detail as { error?: string }).error ?? "Failed to load class"}
      />
    );
  }

  const cls = detail.data;
  const byId = new Map<number, ClassListDto>(
    list.ok ? list.data.map((c) => [c.id, c]) : []
  );

  const profLabel =
    PROFESSION_LABELS[cls.professionLevel] ?? `Tier ${cls.professionLevel}`;
  const parent =
    cls.parentClassId !== null ? byId.get(cls.parentClassId) : null;
  const children = cls.childClassIds
    .map((id) => byId.get(id))
    .filter((c): c is ClassListDto => c !== undefined);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${chronicle}/classes`}
        className="font-mono text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All classes
      </Link>

      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          class · #{cls.id} · {profLabel}
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
          {cls.name}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {cls.race} · {cls.type}
        </p>
      </header>

      {(parent || children.length > 0) && (
        <Section title="Progression">
          <div className="flex flex-col gap-3 text-sm">
            {parent && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Promoted from
                </span>
                <Link
                  href={`/${chronicle}/classes/${parent.id}`}
                  className="text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  {parent.name}
                </Link>
              </div>
            )}
            {children.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Promotes into
                </span>
                <ul className="flex flex-col gap-1 pl-3">
                  {children.map((child) => (
                    <li
                      key={child.id}
                      className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300"
                    >
                      <span className="text-zinc-400 dark:text-zinc-500">
                        •
                      </span>
                      <Link
                        href={`/${chronicle}/classes/${child.id}`}
                        className="hover:underline"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section title={`Skills (${cls.skills.length})`}>
        {cls.skills.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No class skills declared in source data.
          </p>
        ) : (
          <SkillTable chronicle={chronicle} skills={cls.skills} />
        )}
      </Section>
    </div>
  );
}

function SkillTable({
  chronicle,
  skills,
}: {
  chronicle: string;
  skills: ClassSkillLearnDto[];
}) {
  // Sort: by required player level, then by skill name, then by skill level.
  const sorted = [...skills].sort(
    (a, b) =>
      a.minPlayerLevel - b.minPlayerLevel ||
      a.name.localeCompare(b.name) ||
      a.skillLevel - b.skillLevel
  );

  return (
    <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left font-mono text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="w-16 px-3 py-2 text-right">Lvl</th>
            <th className="px-3 py-2">Skill</th>
            <th className="w-16 px-3 py-2 text-right">Sk.Lv</th>
            <th className="w-24 px-3 py-2 text-right">SP</th>
            <th className="px-3 py-2">Spellbook</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr
              key={`${s.skillId}-${s.skillLevel}`}
              className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {s.minPlayerLevel}
              </td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-2">
                  <ItemIcon
                    iconFile={s.iconFile}
                    name={s.name}
                    size={20}
                    decorative
                  />
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {s.name}
                  </span>
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {s.skillLevel}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {s.spCost.toLocaleString()}
              </td>
              <td className="px-3 py-2">
                {s.spellbookItemId ? (
                  <Link
                    href={`/${chronicle}/items/${s.spellbookItemId}`}
                    className="font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    item #{s.spellbookItemId}
                  </Link>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      {message}
    </div>
  );
}
