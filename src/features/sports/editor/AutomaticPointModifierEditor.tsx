import { createId, type AutomaticPointModifier } from "@/domain";
export function AutomaticPointModifierEditor({
  modifiers,
  onChange,
}: {
  modifiers: AutomaticPointModifier[];
  onChange: (modifiers: AutomaticPointModifier[]) => void;
}) {
  const update = (id: string, change: Partial<AutomaticPointModifier>) =>
    onChange(
      modifiers.map((modifier) =>
        modifier.id === id ? { ...modifier, ...change } : modifier,
      ),
    );
  return (
    <div className="mt-2 space-y-3">
      {modifiers.map((modifier) => (
        <div className="rounded-lg bg-surface-container p-3" key={modifier.id}>
          <div className="grid gap-2 md:grid-cols-3">
            <label>
              Bezeichnung
              <input
                value={modifier.label}
                onChange={(event) =>
                  update(modifier.id, { label: event.target.value })
                }
              />
            </label>
            <label>
              Bonusart
              <select
                value={modifier.kind}
                onChange={(event) =>
                  update(modifier.id, {
                    kind: event.target.value as AutomaticPointModifier["kind"],
                    referenceAge:
                      event.target.value === "agePercentagePerYear"
                        ? (modifier.referenceAge ?? 35)
                        : undefined,
                  })
                }
              >
                <option value="fixedPercentage">
                  Fester Anteil der Basispunkte
                </option>
                <option value="agePercentagePerYear">
                  Anteil je Altersjahr
                </option>
              </select>
            </label>
            <label>
              Geschlecht
              <select
                value={modifier.gender}
                onChange={(event) =>
                  update(modifier.id, {
                    gender: event.target
                      .value as AutomaticPointModifier["gender"],
                  })
                }
              >
                <option value="all">Alle</option>
                <option value="male">Männlich</option>
                <option value="female">Weiblich</option>
              </select>
            </label>
            <label>
              Faktor
              <input
                type="number"
                step="any"
                value={modifier.factor}
                onChange={(event) =>
                  update(modifier.id, { factor: Number(event.target.value) })
                }
              />
            </label>
            {modifier.kind === "agePercentagePerYear" && (
              <label>
                Bezugsalter
                <input
                  type="number"
                  value={modifier.referenceAge ?? 35}
                  onChange={(event) =>
                    update(modifier.id, {
                      referenceAge: Number(event.target.value),
                    })
                  }
                />
              </label>
            )}
            <label>
              Mindestalter
              <input
                type="number"
                value={modifier.minAge ?? ""}
                onChange={(event) =>
                  update(modifier.id, {
                    minAge:
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Höchstalter
              <input
                type="number"
                value={modifier.maxAge ?? ""}
                onChange={(event) =>
                  update(modifier.id, {
                    maxAge:
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <p className="mt-2 text-sm text-secondary">
            {modifier.kind === "fixedPercentage"
              ? `Bonus = Basispunkte × ${modifier.factor}`
              : `Bonus = Basispunkte × max(0, Alter − ${modifier.referenceAge ?? 35}) × ${modifier.factor}`}
          </p>
          <button
            className="mt-2 text-sm font-bold text-error underline"
            onClick={() =>
              onChange(modifiers.filter((item) => item.id !== modifier.id))
            }
          >
            Bonus entfernen
          </button>
        </div>
      ))}
      <button
        className="button-secondary"
        onClick={() =>
          onChange([
            ...modifiers,
            {
              id: createId(),
              label: "Neuer automatischer Bonus",
              kind: "fixedPercentage",
              factor: 0,
              gender: "all",
            },
          ])
        }
      >
        Automatischen Bonus hinzufügen
      </button>
    </div>
  );
}
