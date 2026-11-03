"use client";

import { useActionState, useState } from "react";
import { saveShopBranches } from "@/lib/actions/storefront";
import { TownOptions } from "@/components/town-options";
import { btnPrimary, btnSecondary, ErrorNote, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { BRANCH_ADDRESS_MAX, BRANCH_HOURS_MAX, MAX_BRANCHES } from "@/lib/shop-branches";
import type { ActionState } from "@/lib/validators";

type Row = { key: string; id?: string; town: string; address: string; phone: string; hours: string };

const initial: ActionState = { error: "" };

let counter = 0;
function newKey() {
  counter += 1;
  return `new-${counter}`;
}

export function ShopBranchesEditor({
  branches,
}: {
  branches: { id?: string; town: string; address: string; phone: string; hours: string }[];
}) {
  const [state, action] = useActionState(saveShopBranches, initial);
  const [rows, setRows] = useState<Row[]>(() =>
    (branches.length > 0 ? branches : [{ town: "Nairobi", address: "", phone: "", hours: "" }]).map((branch, index) => ({
      key: branch.id ?? `start-${index}`,
      id: branch.id && branch.id !== "legacy" ? branch.id : undefined,
      town: branch.town,
      address: branch.address,
      phone: branch.phone,
      hours: branch.hours,
    })),
  );

  const update = (key: string, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const remove = (key: string) => setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  const add = () =>
    setRows((current) =>
      current.length >= MAX_BRANCHES ? current : [...current, { key: newKey(), town: "", address: "", phone: "", hours: "" }],
    );

  const payload = JSON.stringify(rows.map(({ id, town, address, phone, hours }) => ({ id, town, address, phone, hours })));

  return (
    <form action={action} className="grid gap-4" data-branch-editor>
      <ErrorNote>{state.error}</ErrorNote>
      <input type="hidden" name="branches" value={payload} />
      <ol className="grid gap-3">
        {rows.map((row, index) => (
          <li key={row.key} className="grid gap-3 rounded-xl border border-line/80 p-3.5" data-branch-row>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-navy">
                {index === 0 ? "Main branch" : `Branch ${index + 1}`}
              </p>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => remove(row.key)}
                  className="text-sm font-semibold text-clay hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <label className="block text-sm">
              Town
              <select
                value={row.town}
                onChange={(event) => update(row.key, { town: event.target.value })}
                className={fieldClass}
                required
              >
                <TownOptions blank="Choose a town" />
              </select>
            </label>
            <label className="block text-sm">
              Address <span className="text-ink/60">(optional)</span>
              <input
                value={row.address}
                onChange={(event) => update(row.key, { address: event.target.value })}
                maxLength={BRANCH_ADDRESS_MAX}
                placeholder="Building, street or market stall"
                className={fieldClass}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                Phone <span className="text-ink/60">(optional)</span>
                <input
                  value={row.phone}
                  onChange={(event) => update(row.key, { phone: event.target.value })}
                  inputMode="tel"
                  placeholder="0712 345 678"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm">
                Opening hours <span className="text-ink/60">(optional)</span>
                <input
                  value={row.hours}
                  onChange={(event) => update(row.key, { hours: event.target.value })}
                  maxLength={BRANCH_HOURS_MAX}
                  placeholder="Mon–Sat 8am–6pm"
                  className={fieldClass}
                />
              </label>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {rows.length < MAX_BRANCHES ? (
          <button type="button" onClick={add} className={btnSecondary}>
            Add a branch
          </button>
        ) : null}
        <SubmitButton className={btnPrimary} pendingLabel="Saving…">
          Save branches
        </SubmitButton>
      </div>
    </form>
  );
}
