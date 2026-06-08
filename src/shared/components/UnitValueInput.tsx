import type { Discipline } from "@/domain";

export function UnitValueInput({
  discipline,
  value,
  onChange,
  signed = false,
}: {
  discipline: Discipline;
  value?: number;
  onChange: (value: number | undefined) => void;
  signed?: boolean;
}) {
  if (discipline.unit !== "time")
    return <input type="number" min={signed ? undefined : "0"} step={discipline.unit === "repetitions" ? "1" : "0.01"} value={value ?? ""} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : undefined)} />;
  const total = Math.abs(value ?? 0);
  const sign = (value ?? 0) < 0 ? -1 : 1;
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const hundredths = Math.floor((total % 1000) / 10);
  const update = (m: number, s: number, h: number) => onChange(sign * (m * 60000 + s * 1000 + h * 10));
  return (
    <div className={`grid gap-2 ${signed ? "grid-cols-4" : "grid-cols-3"}`}>
      {signed && <select aria-label="Vorzeichen" value={sign} onChange={(event) => onChange((Number(event.target.value) || 1) * total)}><option value="1">+</option><option value="-1">−</option></select>}
      <input aria-label="Minuten" type="number" min="0" placeholder="Min" value={minutes || ""} onChange={(event) => update(Number(event.target.value), seconds, hundredths)} />
      <input aria-label="Sekunden" type="number" min="0" max="59" placeholder="Sek" value={seconds || ""} onChange={(event) => update(minutes, Number(event.target.value), hundredths)} />
      <input aria-label="Hundertstel" type="number" min="0" max="99" placeholder="1/100" value={hundredths || ""} onChange={(event) => update(minutes, seconds, Number(event.target.value))} />
    </div>
  );
}
