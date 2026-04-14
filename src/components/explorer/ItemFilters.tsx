"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const ITEM_SORT_OPTIONS = [
  { value: "", label: "Default" },
  { value: "id", label: "id ↑" },
  { value: "-id", label: "id ↓" },
  { value: "name", label: "name A→Z" },
  { value: "-name", label: "name Z→A" },
  { value: "grade", label: "grade ↑" },
  { value: "-grade", label: "grade ↓" },
];

export function ItemFilters({
  basePath,
  types,
  grades,
}: {
  basePath: string;
  types: string[];
  grades: string[];
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
      // Always reset offset on filter change.
      params.delete("offset");
      const qs = params.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath);
    },
    [basePath, router]
  );

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
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
      <Field label="Type">
        <select
          name="type"
          defaultValue={searchParams.get("type") ?? ""}
          className={inputClass}
        >
          <option value="">any</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Grade">
        <select
          name="grade"
          defaultValue={searchParams.get("grade") ?? ""}
          className={inputClass}
        >
          <option value="">any</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Sort">
        <select
          name="sort"
          defaultValue={searchParams.get("sort") ?? ""}
          className={inputClass}
        >
          {ITEM_SORT_OPTIONS.map((o) => (
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
