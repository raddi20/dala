import type { AgentCountRow } from "@/lib/agent-code";

/** Sign-ups, shops, first offerings, and directory listings for each brochure code, including none. */
export function AgentCountTable({ rows }: { rows: AgentCountRow[] }) {
  return (
    <section id="field-agents" className="grid gap-3">
      <h2 className="font-serif text-2xl">Field agents</h2>
      <p className="text-sm text-ink/70">
        Sign-ups that carried a brochure code, saved when the account was created. Shops are accounts that opened a
        shop. First offerings are shops with at least one offering that is not archived. Directory listings are
        accounts that posted a classified, which is separate from the shop. “none” had no code.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-sand bg-card">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="border-b border-sand text-ink">
              <th className="px-3 py-3 font-semibold">Agent</th>
              <th className="px-3 py-3 font-semibold">Sign-ups</th>
              <th className="px-3 py-3 font-semibold">Shops</th>
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
