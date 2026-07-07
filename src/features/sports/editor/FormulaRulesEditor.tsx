import { useState } from "react";
import { createId, type Discipline, type FormulaRule, type FormulaSegment } from "@/domain";
import { createLinearFormulaSegments } from "@/domain/scoring";
import { UnitValueInput } from "@/shared/components";
import { genderLabel } from "@/shared/labels";

function formulaUnit(unit: Discipline["unit"]) {
  return unit === "time" ? "Sekunden" : unit === "distance" ? "Meter" : "Wiederholungen";
}

function createDefaultFormulaRules(discipline: Discipline): FormulaRule[] {
  return discipline.ageBands.flatMap((band) =>
    (["male", "female"] as const).map((gender) => ({
      gender,
      ageBandId: band.id,
      formulaValueUnit: "display" as const,
      segments: [
        {
          id: createId(),
          from: null,
          to: null,
          kind: "linear" as const,
          a: 0,
          b: 1,
          c: 0,
        },
      ],
    })),
  );
}

export function FormulaRulesEditor({
  discipline,
  onChange,
}: {
  discipline: Discipline;
  onChange: (formulas: FormulaRule[]) => void;
}) {
  const [matrixDrafts, setMatrixDrafts] = useState<Record<string, { value?: number; points: number }[]>>({});
  const updateRule = (rule: FormulaRule, segments: FormulaSegment[]) =>
    onChange(
      discipline.formulas.map((item) =>
        item === rule ? { ...item, segments } : item,
      ),
    );
  const defaultDraft = [
    { points: discipline.maxPoints },
    { points: discipline.maxPoints / 2 },
    { points: 0 },
  ];
  if (discipline.formulas.length === 0)
    return (
      <div className="mt-2 rounded-lg bg-surface-container p-4">
        <p className="text-sm text-secondary">
          Für diese Disziplin sind noch keine Formelregeln angelegt.
        </p>
        <button
          className="button-secondary mt-3"
          onClick={() => onChange(createDefaultFormulaRules(discipline))}
        >
          Formeln für alle Altersbereiche anlegen
        </button>
      </div>
    );
  return (
    <div className="mt-2 space-y-3">
      {discipline.formulas.map((rule) => {
        const key = `${rule.gender}-${rule.ageBandId}`;
        const draft = matrixDrafts[key] ?? defaultDraft;
        return (
          <div
            className="rounded-lg bg-surface-container p-3"
            key={`${rule.gender}-${rule.ageBandId}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <strong>
                {genderLabel(rule.gender)} ·{" "}
                {
                  discipline.ageBands.find((band) => band.id === rule.ageBandId)
                    ?.label
                }
                {" · "}x = {formulaUnit(discipline.unit)}
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
                Abschnitt hinzufügen
              </button>
            </div>
            <div className="mb-4 rounded-lg bg-surface-container-low p-3">
              <strong>Lineare Segmente aus Stützpunkten</strong>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {draft.map((point, index) => (
                  <div className="grid gap-2" key={index}>
                    <label>
                      Punktwert
                      <input
                        type="number"
                        step="any"
                        value={point.points}
                        onChange={(event) =>
                          setMatrixDrafts((current) => ({
                            ...current,
                            [key]: draft.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, points: Number(event.target.value) }
                                : item,
                            ),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Leistung
                      <UnitValueInput
                        discipline={discipline}
                        value={point.value}
                        onChange={(value) =>
                          setMatrixDrafts((current) => ({
                            ...current,
                            [key]: draft.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, value } : item,
                            ),
                          }))
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
              <button
                className="button-secondary mt-3"
                onClick={() => {
                  try {
                    updateRule(
                      rule,
                      createLinearFormulaSegments(
                        draft.map((point) => ({
                          value: point.value ?? Number.NaN,
                          points: point.points,
                        })),
                        discipline.unit,
                      ),
                    );
                  } catch (error) {
                    alert(error instanceof Error ? error.message : "Formeln konnten nicht erzeugt werden.");
                  }
                }}
              >
                Segmente aus Stützpunkten erzeugen
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
                  {segment.kind === "linear" || segment.a === 0 ? (
                    <>
                      <label>
                        m
                        <input
                          type="number"
                          step="any"
                          value={segment.b}
                          onChange={(event) =>
                            updateRule(
                              rule,
                              rule.segments.map((item) =>
                                item.id === segment.id
                                  ? { ...item, a: 0, b: Number(event.target.value), kind: "linear" }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        b
                        <input
                          type="number"
                          step="any"
                          value={segment.c}
                          onChange={(event) =>
                            updateRule(
                              rule,
                              rule.segments.map((item) =>
                                item.id === segment.id
                                  ? { ...item, a: 0, c: Number(event.target.value), kind: "linear" }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <p className="self-end text-sm text-secondary">y = m·x + b</p>
                    </>
                  ) : (
                    <>
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
                                          Number(event.target.value) === 0
                                            ? "linear"
                                            : item.kind,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                      ))}
                    </>
                  )}
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
        );
      })}
    </div>
  );
}
