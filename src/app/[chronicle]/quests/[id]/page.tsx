import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch } from "@/lib/api/client";
import { ItemIcon } from "@/components/explorer/ItemIcon";
import type {
  ItemQuantityDto,
  NpcRefDto,
} from "@/lib/api/dto/item";
import type {
  QuestClientJournalEntryDto,
  QuestDetailDto,
} from "@/lib/api/dto/quest";

export default async function QuestDetailPage({
  params,
}: {
  params: Promise<{ chronicle: string; id: string }>;
}) {
  const { chronicle, id } = await params;
  if (!isChronicle(chronicle)) notFound();

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const result = await apiFetch<QuestDetailDto>(
    `/api/${chronicle}/quests/${numericId}`
  );
  if (!result.ok) {
    if (result.status === 404) notFound();
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {(result as { error?: string }).error ?? "Failed to load quest"}
      </div>
    );
  }

  const q = result.data;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${chronicle}/quests`}
        className="font-mono text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All quests
      </Link>

      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          quest · #{q.id}
        </p>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            {q.name}
          </h1>
          {q.repeatable === true && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              Repeatable
            </span>
          )}
          {q.repeatable === false && (
            <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
              One-time
            </span>
          )}
        </div>
        {q.primaryRegion && (
          <p className="font-mono text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {q.primaryRegion.name}
          </p>
        )}
        {q.description && (
          <p className="max-w-prose pt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {q.description}
          </p>
        )}
      </header>

      <Section title="Facts">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 font-mono text-xs sm:grid-cols-3 md:grid-cols-4">
          <Fact label="Min level" value={q.levelMin} />
          <Fact
            label="Race"
            value={
              q.raceRestrictions.length > 0
                ? q.raceRestrictions.join(", ")
                : null
            }
          />
          <Fact
            label="Class"
            value={
              q.classRestrictions.length > 0
                ? q.classRestrictions.map((c) => c.name).join(", ")
                : null
            }
          />
          <Fact label="Source" value={q.scriptFile} />
        </dl>
      </Section>

      {q.classRestrictions.length > 0 && (
        <Section title="Class Restrictions">
          <ul className="flex flex-wrap gap-2 text-sm">
            {q.classRestrictions.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${chronicle}/classes/${c.id}`}
                  className="rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-900 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {q.clientJournalEntries && q.clientJournalEntries.length > 0 && (
        <Section title="Quest Log">
          <p className="-mt-2 mb-4 font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            steps from the game client
          </p>
          <JournalEntries
            chronicle={chronicle}
            entries={q.clientJournalEntries}
          />
        </Section>
      )}

      {q.startNpcs.length > 0 && (
        <Section title={q.startNpcs.length === 1 ? "Start NPC" : "Start NPCs"}>
          <NpcList chronicle={chronicle} npcs={q.startNpcs} />
        </Section>
      )}

      {q.involvedNpcs.length > 0 && (
        <Section title={`Involved NPCs (${q.involvedNpcs.length})`}>
          <NpcList chronicle={chronicle} npcs={q.involvedNpcs} />
        </Section>
      )}

      {q.involvedMonsters.length > 0 && (
        <Section title={`Involved Monsters (${q.involvedMonsters.length})`}>
          <NpcList chronicle={chronicle} npcs={q.involvedMonsters} />
        </Section>
      )}

      {q.questItems.length > 0 && (
        <Section title={`Quest Items (${q.questItems.length})`}>
          <ItemRowList chronicle={chronicle} items={q.questItems} hideCount />
        </Section>
      )}

      {hasAnyReward(q.rewards) && (
        <Section title="Rewards">
          <div className="flex flex-col gap-3">
            {(q.rewards.adena || q.rewards.exp || q.rewards.sp) && (
              <dl className="grid grid-cols-3 gap-x-8 gap-y-2 font-mono text-xs">
                {q.rewards.adena != null && (
                  <Fact
                    label="Adena"
                    value={`${q.rewards.adena.toLocaleString()} a`}
                  />
                )}
                {q.rewards.exp != null && (
                  <Fact label="EXP" value={q.rewards.exp.toLocaleString()} />
                )}
                {q.rewards.sp != null && (
                  <Fact label="SP" value={q.rewards.sp.toLocaleString()} />
                )}
              </dl>
            )}
            {q.rewards.items.length > 0 && (
              <ItemRowList chronicle={chronicle} items={q.rewards.items} />
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function hasAnyReward(r: QuestDetailDto["rewards"]): boolean {
  return (
    r.items.length > 0 ||
    r.adena != null ||
    r.exp != null ||
    r.sp != null
  );
}

function NpcList({
  chronicle,
  npcs,
}: {
  chronicle: string;
  npcs: NpcRefDto[];
}) {
  return (
    <ul className="flex flex-wrap gap-2 text-sm">
      {npcs.map((npc) => (
        <li key={npc.id}>
          <Link
            href={`/${chronicle}/npcs/${npc.id}`}
            className="rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-900 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          >
            {npc.name}{" "}
            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              #{npc.id}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ItemRowList({
  chronicle,
  items,
  hideCount = false,
}: {
  chronicle: string;
  items: ItemQuantityDto[];
  hideCount?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it) => (
        <li key={it.itemId}>
          <Link
            href={`/${chronicle}/items/${it.itemId}`}
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <ItemIcon
              iconFile={it.iconFile}
              name={it.name}
              size={20}
              decorative
            />
            <span className="text-zinc-900 dark:text-zinc-100">{it.name}</span>
            {!hideCount && it.count > 1 && (
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                × {it.count.toLocaleString()}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function JournalEntries({
  chronicle,
  entries,
}: {
  chronicle: string;
  entries: QuestClientJournalEntryDto[];
}) {
  return (
    <ol className="flex flex-col gap-3">
      {entries.map((e) => (
        <li
          key={e.stepIndex}
          className="flex gap-3 rounded border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span className="flex-none rounded-full bg-zinc-200 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {e.stepIndex}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {e.title}
              </span>
              {e.completionNpc && (
                <Link
                  href={`/${chronicle}/npcs/${e.completionNpc.id}`}
                  className="font-mono text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  → {e.completionNpc.name}
                </Link>
              )}
            </div>
            {/*
              The DAT carries literal `\\n` characters (two-char
              backslash-n, not a control byte) for line breaks. Rendering
              them as native newlines via `whitespace-pre-line` after a
              one-pass replace gives the player-facing layout the L2
              client uses, without truncation in the API.
            */}
            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {e.description.replace(/\\n/g, "\n").trim()}
            </p>
          </div>
        </li>
      ))}
    </ol>
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

function Fact({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-zinc-900 dark:text-zinc-100">
        {value == null ? "—" : value}
      </dd>
    </div>
  );
}
