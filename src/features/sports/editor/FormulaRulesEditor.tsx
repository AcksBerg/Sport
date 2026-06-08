import { createId, type Discipline, type FormulaRule, type FormulaSegment } from "@/domain";
import { UnitValueInput } from "@/shared/components";
import { genderLabel } from "@/shared/labels";
export function FormulaRulesEditor({
  discipline,
  onChange,
}: {
  discipline: Discipline;
  onChange: (formulas: FormulaRule[]) => void;
}) {
  const updateRule = (rule: FormulaRule, segments: FormulaSegment[]) =>
    onChange(
      discipline.formulas.map((item) =>
        item === rule ? { ...item, segments } : item,
      ),
    );
  return (
    <div className="mt-2 space-y-3">
      {discipline.formulas.map((rule) => (
        <div
          className="rounded-lg bg-surface-container p-3"
          key={`${rule.gender}-${rule.ageBandId}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <strong>
              {genderLabel(rule.gender)} Â·{" "}
              {
                discipline.ageBands.find((band) => band.id === rule.ageBandId)
                  ?.label
              }
              {" Â· "}x ={" "}
              {discipline.unit === "time"
                ? "Sekunden"
                : discipline.unit === "distance"
                  ? "Meter"
                  : "Wiederholungen"}
            </strong>
            <button
              className="button-secondary"
              onClick={() => {
                const previous = rule.segments.at(-1);
                const splitValue = discipline.unit === "time" ? 100_000 : 100;
                const nextValue =
                  splitValue +
                  (discipline.unit === "time"
                    ? 10
                    : discipline.unit === "distance"
                      ? 0.01
                      : 1);
                updateRule(rule, [
                  ...rule.segments.map((segment, index) =>
                    index === rule.segments.length - 1
                      ? { ...segment, to: splitValue }
                      : segment,
                  ),
                  {
                    id: createId(),
                    from: nextValue,
                    to: null,
                    kind: previous?.kind ?? "linear",
                    a: previous?.a ?? 0,
                    b: previous?.b ?? 1,
                    c: previous?.c ?? 0,
                  },
                ]);
              }}
            >
              Abschnitt hinzufÃ¼gen
            </button>
          </div>
          <div className="space-y-2">
            {rule.segments.map((segment, segmentIndex) => (
              <div className="grid gap-2 sm:grid-cols-6" key={segment.id}>
                <label>
                  Von
                  {segmentIndex === 0 ? (
                    <input disabled value="offen" />
                  ) : (
                    <UnitValueInput
                      discipline={discipline}
                      value={segment.from ?? undefined}
                      onChange={(value) =>
                        value !== undefined &&
                        updateRule(
                          rule,
                          rule.segments.map((item) =>
                            item.id === segment.id
                              ? { ...item, from: value }
                              : item,
                          ),
                        )
                      }
                    />
                  )}
                </label>
                <label>
                  Bis
                  {segmentIndex === rule.segments.length - 1 ? (
                    <input disabled value="offen" />
                  ) : (
                    <UnitValueInput
                      discipline={discipline}
                      value={segment.to ?? undefined}
                      onChange={(value) =>
                        value !== undefined &&
                        updateRule(
                          rule,
                          rule.segments.map((item) =>
                            item.id === segment.id
                              ? { ...item, to: value }
                              : item,
                          ),
                        )
                      }
                    />
                  )}
                </label>
                {(["a", "b", "c"] as const).map((coefficient) => (
                  <label key={coefficient}>
                    {coefficient}
                    <input
                      type="number"
                      step="any"
                      value={segment[coefficient]}
                      onChange={(event) =>
                        updateRule(
                          rule,
                          rule.segments.map((item) =>
                            item.id === segment.id
                              ? {
                                  ...item,
                                  [coefficient]: Number(event.target.value),
                                  kind:
                                    coefficient === "a" &&
                                    Number(event.target.value) !== 0
                                      ? "quadratic"
                                      : item.kind,
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <button
                  className="button-danger self-end"
                  disabled={rule.segments.length === 1}
                  onClick={() => {
                    const next = rule.segments
                      .filter((item) => item.id !== segment.id)
                      .map((item, index, all) => ({
                        ...item,
                        from: index === 0 ? null : item.from,
                        to: index === all.length - 1 ? null : item.to,
                      }));
                    updateRule(rule, next);
                  }}
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}