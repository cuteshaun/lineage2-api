// "use client";

// import { useState } from "react";

// type Props = {
//   /** Path or full URL to copy. If a path (starts with "/"), it is prefixed with window.location.origin at click time. */
//   value: string;
//   className?: string;
//   label?: string;
//   copiedLabel?: string;
// };

// export function CopyUrlButton({
//   value,
//   className,
//   label = "Copy URL",
//   copiedLabel = "Copied",
// }: Props) {
//   const [copied, setCopied] = useState(false);

//   async function handleClick() {
//     const toCopy =
//       value.startsWith("/") && typeof window !== "undefined"
//         ? `${window.location.origin}${value}`
//         : value;
//     try {
//       await navigator.clipboard.writeText(toCopy);
//       setCopied(true);
//       window.setTimeout(() => setCopied(false), 1500);
//     } catch {
//       // Clipboard unavailable; silently no-op.
//     }
//   }

//   return (
//     <button
//       type="button"
//       onClick={handleClick}
//       aria-live="polite"
//       aria-label={copied ? "URL copied to clipboard" : "Copy URL to clipboard"}
//       className={
//         className ??
//         "cursor-pointer text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--blue)]"
//       }
//     >
//       {copied ? copiedLabel : label}
//     </button>
//   );
// }
