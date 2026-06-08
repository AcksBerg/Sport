import { CategoryScale, Chart as ChartJS, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import type { Discipline, TableRule } from "@/domain";
import { scoreConfiguredDiscipline } from "@/domain/scoring";
import { calculateChartDomain, calculateChartPointDomain, createTableChartPoints, formatChartTick, formatChartTooltip } from "@/shared/utils/charts";
import { genderLabel, unitLabel } from "@/shared/labels";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);
export function FormulaChart({ discipline }: { discipline: Discipline }) {
  const [expanded, setExpanded] = useState(false);
  const [previewAge, setPreviewAge] = useState(35);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
    else dialog.current?.close();
  }, [expanded]);
  const domain = calculateChartDomain(discipline);
  const pointDomain = calculateChartPointDomain(discipline);
  const rules =
    discipline.scoringMode === "table"
      ? (discipline.tables ?? [])
      : discipline.formulas;
  const ageBandIndexes = new Map(
    discipline.ageBands.map((band, index) => [band.id, index]),
  );
  const genderColors = {
    male: ["#1d4ed8", "#2563eb", "#60a5fa", "#93c5fd"],
    female: ["#15803d", "#16a34a", "#4ade80", "#86efac"],
  };
  const datasets = rules.map((rule, index) => {
    const points =
      discipline.scoringMode === "table"
        ? createTableChartPoints(rule as TableRule, discipline, true)
            .map((point) => ({
              ...point,
              y:
                scoreConfiguredDiscipline(
                  discipline,
                  point.x,
                  rule.gender,
                  rule.ageBandId,
                  previewAge,
                ) ?? point.y,
            }))
            .filter((point) => !discipline.cutoff || point.y !== 0)
        : Array.from({ length: 161 }, (_, offset) => {
            const value =
              domain.min + ((domain.max - domain.min) * offset) / 160;
            const points = scoreConfiguredDiscipline(
              discipline,
              value,
              rule.gender,
              rule.ageBandId,
              previewAge,
            );
            return {
              x: value,
              y: points === 0 && discipline.cutoff ? null : (points ?? 0),
            };
          });
    const colorIndex =
      (ageBandIndexes.get(rule.ageBandId) ?? index) %
      genderColors[rule.gender].length;
    return {
      label: `${genderLabel(rule.gender)} · ${discipline.ageBands.find((band) => band.id === rule.ageBandId)?.label}`,
      data: points,
      borderColor: genderColors[rule.gender][colorIndex],
      backgroundColor: genderColors[rule.gender][colorIndex],
      pointStyle:
        rule.gender === "male" ? ("triangle" as const) : ("circle" as const),
      pointRadius: 3,
      showLine: true,
      spanGaps: false,
      stepped: discipline.scoringMode === "table",
    };
  });
  if (discipline.cutoff?.kind === "points") {
    datasets.push({
      label: `Cut-off: ${discipline.cutoff.threshold} Punkte`,
      data: [
        { x: domain.min, y: discipline.cutoff.threshold },
        { x: domain.max, y: discipline.cutoff.threshold },
      ],
      borderColor: "#dd0000",
      backgroundColor: "#dd0000",
      pointStyle: "circle" as const,
      pointRadius: 0,
      showLine: true,
      spanGaps: false,
      stepped: false,
    });
  }
  const chart = (fullscreen = false) => (
    <div className={fullscreen ? "h-[85vh]" : "h-64"}>
      <Line
        options={{
          responsive: true,
          maintainAspectRatio: false,
          parsing: false,
          scales: {
            x: {
              type: "linear",
              min: domain.min,
              max: domain.max,
              title: {
                display: true,
                text: `Leistung (${unitLabel(discipline.unit)})`,
              },
              ticks: {
                callback: (value) =>
                  formatChartTick(Number(value), discipline.unit),
                minRotation: 45,
                maxRotation: 45,
              },
            },
            y: {
              min: pointDomain.min,
              max: pointDomain.max,
              title: { display: true, text: "Punkte" },
            },
          },
          plugins: {
            tooltip: {
              callbacks: {
                title: (items) =>
                  items[0]
                    ? formatChartTooltip(
                        Number(items[0].parsed.x),
                        discipline.unit,
                      )
                    : "",
              },
            },
          },
        }}
        data={{ datasets }}
      />
    </div>
  );
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-end gap-2">
        <label className="max-w-32">
          Vorschaualter
          <input
            type="number"
            min="0"
            value={previewAge}
            onChange={(event) => setPreviewAge(Number(event.target.value))}
          />
        </label>
        <button className="button-secondary" onClick={() => setExpanded(true)}>
          Diagramm vergrößern
        </button>
      </div>
      {chart()}
      <dialog
        ref={dialog}
        className="m-auto h-[95vh] w-[95vw] max-w-none rounded-xl bg-surface p-4 text-on-surface backdrop:bg-black/70"
        onCancel={() => setExpanded(false)}
        onClick={(event) => {
          if (event.target === dialog.current) setExpanded(false);
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <strong>{discipline.name}</strong>
          <button
            className="button-secondary"
            onClick={() => setExpanded(false)}
          >
            Schließen
          </button>
        </div>
        {chart(true)}
      </dialog>
    </div>
  );
}
