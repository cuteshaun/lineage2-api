/**
 * Compact key/value list for entity detail pages. Renders any value as text
 * (JSON.stringified for objects/arrays) and shows "—" for null/undefined.
 */
export function FieldList({
  fields,
}: {
  fields: Array<{ label: string; value: unknown }>;
}) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
      {fields.map(({ label, value }) => (
        <div key={label} className="contents">
          <dt className="font-mono text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {label}
          </dt>
          <dd className="font-mono text-zinc-900 dark:text-zinc-100">
            {formatValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value === "" ? "—" : value;
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return JSON.stringify(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
