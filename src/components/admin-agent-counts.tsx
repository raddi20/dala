import type { AgentCountRow, AgentRange } from "@/lib/agent-code";
import { btnSecondary, fieldClass } from "@/components/ui";

/** Sign-ups, shops, published shops, first offerings, and directory listings for each brochure code. */
export function AgentCountTable({ rows, range }: { rows: AgentCountRow[]; range: AgentRange }) {
  const presetClass = (preset: string) =>
    range.preset === preset ? "font-semibold text-navy underline" : "font-semibold text-lake-dark underline";
  return (
    <section id="field-agents" className="grid gap-3">
      <h2 className="font-serif text-2xl">Field agents</h2>
      <p className="text-sm text-ink/70">
        Sign-ups that carried a known brochure code, saved when the account was created. Shops are accounts that opened
        a shop. Published shops are live: published, not taken down, and the owner is not suspended. First offerings are
        shops with at least one offering that is not archived. Directory listings are accounts that posted a classified,
        which is separate from the shop. “none” had no code. A stored code that is not on the agent list is counted as
        other. Dates use Africa/Nairobi. This week starts on Monday. Launch weekend is 17–18 Oct 2026.
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a className={presetClass("all")} href="/admin#field-agents">
          All dates
        </a>
        <a className={presetClass("today")} href="/admin?agents=today#field-agents">
          Today
        </a>
        <a className={presetClass("week")} href="/admin?agents=week#field-agents">
          This week
        </a>
        <a className={presetClass("launch")} href="/admin?agents=launch#field-agents">
          Launch weekend
        </a>
        <span className="text-ink/60">{range.label}</span>
      </div>
      <form action="/admin#field-agents" method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="agents" value="custom" />
        <label className="grid gap-1 text-sm text-ink/80">
          From
          <input type="date" name="agentFrom" defaultValue={range.fromInput} className={fieldClass} />
        </label>
        <label className="grid gap-1 text-sm text-ink/80">
          To
          <input type="date" name="agentTo" defaultValue={range.toInput} className={fieldClass} />
        </label>
        <button className={btnSecondary} type="submit">
          Apply dates
        </button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-sand bg-card">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-sand text-ink">
              <th className="px-3 py-3 font-semibold">Agent</th>
              <th className="px-3 py-3 font-semibold">Sign-ups</th>
              <th className="px-3 py-3 font-semibold">Shops</th>
              <th className="px-3 py-3 font-semibold">Published shops</th>
              <th className="px-3 py-3 font-semibold">First offerings</th>
              <th className="px-3 py-3 font-semibold">Directory listings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} className="border-b border-sand/80 last:border-0">
                <th scope="row" className="px-3 py-3 font-semibold text-navy">
                  {row.code}
                </th>
                <td className="px-3 py-3">{row.signups}</td>
                <td className="px-3 py-3">{row.shops}</td>
                <td className="px-3 py-3">{row.publishedShops}</td>
                <td className="px-3 py-3">{row.firstOfferings}</td>
                <td className="px-3 py-3">{row.directoryListings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
