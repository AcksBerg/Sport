import { createId, type Discipline } from "@/domain";
import { UnitValueInput } from "@/shared/components";
export function AdjustmentEditor({
  discipline,
  onChange,
}: {
  discipline: Discipline;
  onChange: (groups: NonNullable<Discipline["adjustmentGroups"]>) => void;
}) {
  const groups = discipline.adjustmentGroups ?? [];
  return (
    <div className="mt-2 space-y-3">
      {groups.map((group) => (
        <div className="rounded-lg bg-surface-container p-3" key={group.id}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label>
              Bezeichnung
              <input
                value={group.label}
                onChange={(e) =>
                  onChange(
                    groups.map((item) =>
                      item.id === group.id
                        ? { ...item, label: e.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <label className="flex grid-cols-none items-center gap-2 self-end">
              <input
                className="w-auto"
                type="checkbox"
                checked={group.required}
                onChange={(e) =>
                  onChange(
                    groups.map((item) =>
                      item.id === group.id
                        ? {
                            ...item,
                            required: e.target.checked,
                            options: e.target.checked
                              ? item.options.filter(
                                  (option) => option.label !== "Nicht vergeben",
                                )
                              : item.options.some(
                                    (option) => option.valueAdjustment === 0,
                                  )
                                ? item.options
                                : [
                                    {
                                      id: createId(),
                                      label: "Nicht vergeben",
                                      valueAdjustment: 0,
                                      effect: "pointAdjustment",
                                    },
                                    ...item.options,
                                  ],
                          }
                        : item,
                    ),
                  )
                }
              />
              Verpflichtend
            </label>
          </div>
          {group.options.map((option) => {
            const effect =
              option.effect ??
              (group.target === "points"
                ? "pointAdjustment"
                : "performanceAdjustment");
            return (
              <div
                className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
                key={option.id}
              >
                <label>
                  Option
                  <input
                    value={option.label}
                    onChange={(e) =>
                      onChange(
                        groups.map((item) =>
                          item.id === group.id
                            ? {
                                ...item,
                                options: item.options.map((candidate) =>
                                  candidate.id === option.id
                                    ? { ...candidate, label: e.target.value }
                                    : candidate,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Wirkung
                  <select
                    value={effect}
                    onChange={(e) =>
                      onChange(
                        groups.map((item) =>
                          item.id === group.id
                            ? {
                                ...item,
                                options: item.options.map((candidate) =>
                                  candidate.id === option.id
                                    ? {
                                        ...candidate,
                                        effect: e.target.value as NonNullable<
                                          typeof option.effect
                                        >,
                                      }
                                    : candidate,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="performanceAdjustment">
                      Leistung addieren
                    </option>
                    <option value="pointAdjustment">Punkte addieren</option>
                    <option value="minimumPoints">Mindestpunkte</option>
                    <option value="maximumPoints">Maximalpunkte</option>
                  </select>
                </label>
                <label>
                  Wert
                  {effect === "performanceAdjustment" ? (
                    <UnitValueInput
                      discipline={discipline}
                      signed
                      value={option.valueAdjustment}
                      onChange={(value) =>
                        value !== undefined &&
                        onChange(
                          groups.map((item) =>
                            item.id === group.id
                              ? {
                                  ...item,
                                  options: item.options.map((candidate) =>
                                    candidate.id === option.id
                                      ? { ...candidate, valueAdjustment: value }
                                      : candidate,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  ) : (
                    <input
                      type="number"
                      step="any"
                      value={option.valueAdjustment}
                      onChange={(e) =>
                        onChange(
                          groups.map((item) =>
                            item.id === group.id
                              ? {
                                  ...item,
                                  options: item.options.map((candidate) =>
                                    candidate.id === option.id
                                      ? {
                                          ...candidate,
                                          valueAdjustment: Number(
                                            e.target.value,
                                          ),
                                        }
                                      : candidate,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  )}
                </label>
                <button
                  className="button-danger self-end"
                  onClick={() =>
                    onChange(
                      groups.map((item) =>
                        item.id === group.id
                          ? {
                              ...item,
                              options: item.options.filter(
                                (candidate) => candidate.id !== option.id,
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                >
                  Entfernen
                </button>
              </div>
            );
          })}
          <div className="mt-2 flex gap-2">
            <button
              className="button-secondary"
              onClick={() =>
                onChange(
                  groups.map((item) =>
                    item.id === group.id
                      ? {
                          ...item,
                          options: [
                            ...item.options,
                            {
                              id: createId(),
                              label: "Neue Option",
                              valueAdjustment: 0,
                            },
                          ],
                        }
                      : item,
                  ),
                )
              }
            >
              Option hinzufügen
            </button>
            <button
              className="button-danger"
              onClick={() =>
                onChange(groups.filter((item) => item.id !== group.id))
              }
            >
              Gruppe entfernen
            </button>
          </div>
        </div>
      ))}
      <button
        className="button-secondary"
        onClick={() =>
          onChange([
            ...groups,
            {
              id: createId(),
              label: "Neue Korrekturgruppe",
              required: false,
              target: "performance",
              options: [
                { id: createId(), label: "Nicht vergeben", valueAdjustment: 0 },
              ],
            },
          ])
        }
      >
        Korrekturgruppe hinzufügen
      </button>
    </div>
  );
}