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
          <SkillsByLevel chronicle={chronicle} skills={cls.skills} />
        )}
      </Section>
    </div>
  );
}

function SkillsByLevel({
  chronicle,
  skills,
}: {
  chronicle: string;
  skills: ClassSkillLearnDto[];
}) {
  // Group skills by minPlayerLevel; within each group, sort by skill
  // name then skill level for stable rendering.
  const groups = new Map<number, ClassSkillLearnDto[]>();
  for (const s of skills) {
    let list = groups.get(s.minPlayerLevel);
    if (!list) {
      list = [];
      groups.set(s.minPlayerLevel, list);
    }
    list.push(s);
  }
  const orderedLevels = [...groups.keys()].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-6">
      {orderedLevels.map((level) => {
        const rows = (groups.get(level) ?? []).sort(
          (a, b) =>
            a.name.localeCompare(b.name) || a.skillLevel - b.skillLevel
        );
        return (
          <section key={level} className="flex flex-col gap-2">
            <h3 className="font-mono text-sm font-bold text-amber-500 dark:text-amber-400">
              Lvl {level}
            </h3>
            <ul className="flex flex-col gap-2 pl-3">
              {rows.map((s) => (
                <SkillRow
                  key={`${s.skillId}-${s.skillLevel}`}
                  chronicle={chronicle}
                  skill={s}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SkillRow({
  chronicle,
  skill,
}: {
  chronicle: string;
  skill: ClassSkillLearnDto;
}) {
  return (
    <li className="flex items-start gap-3">
      <ItemIcon
        iconFile={skill.iconFile}
        name={skill.name}
        size={28}
        decorative
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {skill.name}{" "}
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              Lv {skill.skillLevel}
            </span>
          </span>
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {skill.spCost.toLocaleString()} SP
          </span>
          {skill.mpConsume != null && skill.mpConsume > 0 && (
            <span className="font-mono text-xs text-sky-600 dark:text-sky-400">
              {skill.mpConsume} MP
            </span>
          )}
          {skill.spellbook && (
            <Link
              href={`/${chronicle}/items/${skill.spellbook.itemId}`}
              className="flex items-center gap-1.5 rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
            >
              <ItemIcon
                iconFile={skill.spellbook.iconFile}
                name={skill.spellbook.name}
                size={14}
                decorative
              />
              <span>{skill.spellbook.name}</span>
            </Link>
          )}
        </div>
        {skill.description && (
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {skill.description}
          </p>
        )}
      </div>
    </li>
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
