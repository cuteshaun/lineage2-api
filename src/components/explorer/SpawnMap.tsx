import Image from "next/image";
import mapImage from "@/interlude-big-map.png";
import { worldToMap } from "@/lib/world-map";
import type { Spawn } from "@/lib/types";

/**
 * Proof-of-concept spawn map overlay.
 *
 * Renders the bundled Interlude world map (1812×2620 PNG) with one small
 * marker per spawn point absolutely positioned on top. Markers use CSS
 * percentages from `worldToMap()`, so marker placement stays accurate at
 * any rendered size — the container just needs to preserve the image's
 * aspect ratio, which `next/image` handles naturally.
 *
 * This is a spike. No zoom, no pan, no clustering of overlapping markers,
 * no region labels. The mapping is approximate; see `lib/world-map.ts`
 * for the calibration rationale.
 */
export function SpawnMap({ spawns }: { spawns: Spawn[] }) {
  return (
    <div className="relative mx-auto w-full max-w-[900px] overflow-hidden rounded border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
      <Image
        src={mapImage}
        alt="Interlude world map"
        className="block h-auto w-full"
        sizes="(max-width: 900px) 100vw, 900px"
        placeholder="blur"
        priority={false}
      />
      {spawns.map((s, idx) => {
        const pos = worldToMap(s.x, s.y);
        return (
          <span
            key={`${s.x}-${s.y}-${s.z}-${idx}`}
            title={`X: ${s.x.toLocaleString()}   Y: ${s.y.toLocaleString()}   Z: ${s.z.toLocaleString()}`}
            style={{ left: pos.left, top: pos.top }}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-red-500 shadow"
          />
        );
      })}
      <p className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white">
        calibration approximate · spike
      </p>
    </div>
  );
}
