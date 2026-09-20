import { DEFAULT_SCALE, EXPORT_SCALES, isHeavyScale, type ExportScaleId } from "../lib/export";
import { Label } from "./ui/label";

type Props = {
  value: ExportScaleId;
  onChange: (value: ExportScaleId) => void;
  label?: string;
  /** إخفاء خيار الطباعة في الأدوات غير الورقية */
  withPrint?: boolean;
  className?: string;
};

export function ExportQuality({
  value,
  onChange,
  label = "دقة التصدير",
  withPrint = true,
  className,
}: Props) {
  const options = withPrint ? EXPORT_SCALES : EXPORT_SCALES.filter((s) => s.id !== "print");

  return (
    <div className={className}>
      <div className="grid gap-2">
        <Label htmlFor="export-quality">{label}</Label>
        <select
          id="export-quality"
          value={value}
          onChange={(e) => onChange(e.target.value as ExportScaleId)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
              {s.hint ? ` — ${s.hint}` : ""}
            </option>
          ))}
        </select>
        {isHeavyScale(value) && (
          <p className="text-xs text-muted-foreground">
            الدقة العالية جداً قد تأخذ وقتاً أطول على الأجهزة الضعيفة.
          </p>
        )}
      </div>
    </div>
  );
}

export { DEFAULT_SCALE };
