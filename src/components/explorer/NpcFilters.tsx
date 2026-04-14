"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const NPC_SORT_OPTIONS = [
  { value: "", label: "Default" },
  { value: "id", label: "id ↑" },
  { value: "-id", label: "id ↓" },
  { value: "name", label: "name A→Z" },
  { value: "-name", label: "name Z→A" },
  { value: "level", label: "level ↑" },
  { value: "-level", label: "level ↓" },
];

/**
 * Filter form used by both /npcs and /monsters. The caller provides the
 * allowed npcType values so that /monsters can expose only monster types.
 */
export function NpcFilters({
  basePath,
  npcTypes,
}: {
  basePath: string;
  npcTypes: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      const params = new URLSearchParams();
      for (const [key, value] of form.entries()) {
        const v = String(value).trim();
        if (v) params.set(key, v);
      }
      params.delete("offset");
      const qs = params.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath);
    },
    [basePath, router]
  );

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6"
    >
      <Field label="Search">
        <input
          name="q"
          type="text"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="name contains…"
          className={inputClass}
        />
      </Field>
      <Field label="npcType">
        <select
          name="npcType"
          defaultValue={searchParams.get("npcType") ?? ""}
          className={inputClass}
        >
          <option value="">any</option>
          {npcTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Level ≥">
        <input
          name="levelMin"
          type="number"
          min="1"
          defaultValue={searchParams.get("levelMin") ?? ""}
          placeholder="—"
          className={inputClass}
        />
      </Field>
      <Field label="Level ≤">
        <input
          name="levelMax"
          type="number"
          min="1"
          defaultValue={searchParams.get("levelMax") ?? ""}
          placeholder="—"
          className={inputClass}
        />
      </Field>
      <Field label="Sort">
        <select
          name="sort"
          defaultValue={searchParams.get("sort") ?? ""}
          className={inputClass}
        >
          {NPC_SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex items-end">
        <button type="submit" className={buttonClass}>
          Apply
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-400";

const buttonClass =
  "w-full rounded bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
