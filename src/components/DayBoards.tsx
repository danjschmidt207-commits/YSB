import Link from "next/link";
import { DOW_NAMES, DOW_SHORT } from "@/lib/dates";
import { formatBoards } from "@/lib/calc";
import type { DayPlanPreview } from "@/lib/queries";

/**
 * Boil & season card for one bake day: the full bake (retail + wholesale) split by flavor, shown
 * in half-board steps (24 bagels/board). `size="lg"` is the highlighted current/next day.
 */
export function DayBoards({
  day,
  size = "sm",
  highlight = false,
  href,
}: {
  day: DayPlanPreview;
  size?: "lg" | "sm";
  highlight?: boolean;
  href?: string;
}) {
  const lg = size === "lg";
  const inner = (
    <div
      className={`card h-full space-y-2 ${highlight ? "border-crust/30 bg-sesame/20 ring-2 ring-crust/15" : ""} ${
        href ? "transition hover:border-crust/30" : ""
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className={`font-bold ${lg ? "text-lg" : "text-sm"}`}>
          {lg ? DOW_NAMES[day.dow] : DOW_SHORT[day.dow]} <span className="text-crust/40">{day.dateIso.slice(5)}</span>
        </span>
        <span className={`tabular-nums ${lg ? "text-sm" : "text-xs"} text-crust/50`}>
          {day.bakeTotal} bagels
        </span>
      </div>

      {day.bakeTotal === 0 ? (
        <p className="text-xs text-crust/40">No plan yet.</p>
      ) : (
        <table className="w-full">
          <tbody>
            {day.flavors.map((f) => (
              <tr key={f.flavorId} className="border-t border-crust/5 first:border-0">
                <td className={`py-1 text-crust/70 ${lg ? "text-base" : "text-xs"}`}>{f.name}</td>
                <td className={`py-1 text-right font-bold tabular-nums ${lg ? "text-xl" : "text-sm"}`}>
                  {formatBoards(f.boards)}
                  <span className={`ml-1 font-normal text-crust/40 ${lg ? "text-xs" : "text-[10px]"}`}>brds</span>
                </td>
                <td className="w-10 py-1 text-right text-[10px] tabular-nums text-crust/35">{f.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {day.wholesale > 0 && (
        <div className="text-[10px] text-crust/40">incl. {day.wholesale} wholesale ({day.retail} retail)</div>
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
