import { createFileRoute } from "@tanstack/react-router";
import { Download, Layers, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "../../components/PrivacyNote";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { downloadBlob } from "../../lib/save";

export const Route = createFileRoute("/tools/barcode")({
  head: () => ({
    meta: [
      { title: "صانع الباركود وQR — منصة الأستاذ" },
      { name: "description", content: "أنشئ باركود وQR بخلفية شفافة أو ملونة، وصدّر الصورة بصيغة PNG أو SVG." },
      { property: "og:title", content: "صانع الباركود وQR — منصة الأستاذ" },
      { property: "og:description", content: "تصميم باركود وQR قابل للتخصيص والتصدير بخلفية شفافة أو ملونة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BarcodeTool,
});

type Format = "qrcode" | "code128" | "ean13" | "datamatrix";
type Generator = typeof import("bwip-js/browser");

const formats: { id: Format; name: string; example: string }[] = [
  { id: "qrcode", name: "QR", example: "https://example.com" },
  { id: "code128", name: "Code 128", example: "CERT-2026-001" },
  { id: "ean13", name: "EAN-13", example: "590123412345" },
  { id: "datamatrix", name: "Data Matrix", example: "CERT-2026-001" },
];

function BarcodeTool() {
  const [format, setFormat] = useState<Format>("qrcode");
  const [value, setValue] = useState("https://example.com");
  const [transparent, setTransparent] = useState(false);
  const [ink, setInk] = useState("#163a42");
  const [paper, setPaper] = useState("#ffffff");
  const [scale, setScale] = useState(5);
  const [height, setHeight] = useState(18);
  const [padding, setPadding] = useState(4);
  const [showText, setShowText] = useState(true);
  const [error, setError] = useState("");
  const [generator, setGenerator] = useState<Generator | null>(null);
  const [batchText, setBatchText] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);
  const batchLines = batchText.split("\n").map((l) => l.trim()).filter(Boolean);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linear = format === "code128" || format === "ean13";

  useEffect(() => {
    let active = true;
    import("bwip-js/browser").then((module) => { if (active) setGenerator(module); });
    return () => { active = false; };
  }, []);

  const options = {
    bcid: format,
    text: value,
    scale,
    height,
    paddingwidth: padding,
    paddingheight: padding,
    barcolor: ink.slice(1),
    textcolor: ink.slice(1),
    ...(transparent ? {} : { backgroundcolor: paper.slice(1) }),
    includetext: linear && showText,
    textxalign: "center" as const,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !generator) return;
    if (!value.trim()) {
      setError("أدخل النص أو الرقم أولاً");
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    try {
      generator.toCanvas(canvas, options);
      setError("");
    } catch {
      setError(format === "ean13" ? "يحتاج EAN-13 إلى 12 أو 13 رقماً صالحاً." : "تعذر إنشاء الرمز. تحقق من النص المدخل.");
      canvas.width = 0;
      canvas.height = 0;
    }
  }, [generator, format, value, scale, height, padding, ink, paper, transparent, showText]);

  const changeFormat = (next: Format) => {
    setFormat(next);
    setValue(formats.find((item) => item.id === next)?.example ?? "");
  };

  const download = (kind: "png" | "svg") => {
    if (!generator || error || !value.trim()) return;
    try {
      const name = `barcode-${format}`;
      if (kind === "svg") {
        downloadBlob(new Blob([generator.toSVG(options)], { type: "image/svg+xml" }), `${name}.svg`);
      } else {
        const canvas = document.createElement("canvas");
        generator.toCanvas(canvas, options);
        canvas.toBlob((blob) => {
          if (blob) downloadBlob(blob, `${name}.png`);
          else toast.error("تعذر حفظ الصورة");
        }, "image/png");
      }
    } catch {
      toast.error("تعذر حفظ الباركود. تحقق من البيانات المدخلة.");
    }
  };

  const makePng = async (text: string): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    generator!.toCanvas(canvas, { ...options, text });
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("png");
    return blob;
  };

  const safeName = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 60) || "code";

  const generateBatch = async (asZip: boolean) => {
    if (!generator || batchLines.length === 0) return;
    setBatchBusy(true);
    try {
      const failed: string[] = [];
      const files: { name: string; blob: Blob }[] = [];
      for (let i = 0; i < batchLines.length; i++) {
        const text = batchLines[i]!;
        try {
          const blob = await makePng(text);
          files.push({ name: `${String(i + 1).padStart(3, "0")}-${safeName(text)}.png`, blob });
        } catch {
          failed.push(text);
        }
      }
      if (files.length === 0) {
        toast.error("تعذر إنشاء أي رمز. تحقق من القيم المدخلة.");
        return;
      }
      if (asZip) {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        for (const f of files) zip.file(f.name, f.blob);
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBlob(blob, `barcodes-${format}.zip`);
      } else {
        for (const f of files) {
          downloadBlob(f.blob, f.name);
          await new Promise((r) => setTimeout(r, 150));
        }
      }
      toast.success(`تم إنشاء ${files.length} رمزاً`);
      if (failed.length) toast.warning(`تعذر إنشاء ${failed.length} رمز — تحقق من صحة القيم`);
    } catch {
      toast.error("تعذر الإنشاء الجماعي");
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10">
      <PageHeader icon={<ScanLine className="size-6" />} title="صانع الباركود" description="أنشئ باركود أو رمز QR وخصّص مظهره قبل الحفظ." />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="surface grid gap-6 p-5 sm:p-6">
          <div className="grid gap-2">
            <Label>نوع الرمز</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2" role="group" aria-label="نوع الباركود">
              {formats.map((item) => (
                <Button key={item.id} type="button" variant={format === item.id ? "default" : "outline"} aria-pressed={format === item.id} onClick={() => changeFormat(item.id)}>{item.name}</Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="barcode-value">{format === "ean13" ? "الأرقام" : "النص أو الرابط"}</Label>
            {format === "qrcode" || format === "datamatrix" ? (
              <textarea id="barcode-value" dir="auto" rows={3} className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={value} onChange={(event) => setValue(event.target.value)} />
            ) : (
              <Input id="barcode-value" dir="ltr" value={value} onChange={(event) => setValue(event.target.value)} inputMode={format === "ean13" ? "numeric" : "text"} />
            )}
            {format === "ean13" && <p className="text-xs text-muted-foreground">أدخل 12 رقماً لإضافة رقم التحقق تلقائياً، أو 13 رقماً صحيحة.</p>}
          </div>

          <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="barcode-ink">لون الرمز</Label>
              <div className="flex items-center gap-2"><input id="barcode-ink" aria-label="لون الرمز" type="color" value={ink} onChange={(event) => setInk(event.target.value)} className="h-10 w-14 cursor-pointer rounded border border-input bg-background p-1" /><Input dir="ltr" aria-label="قيمة لون الرمز" value={ink} onChange={(event) => { if (/^#[\da-fA-F]{6}$/.test(event.target.value)) setInk(event.target.value); }} /></div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="barcode-paper">لون الخلفية</Label>
              <div className="flex items-center gap-2"><input id="barcode-paper" aria-label="لون الخلفية" type="color" disabled={transparent} value={paper} onChange={(event) => setPaper(event.target.value)} className="h-10 w-14 cursor-pointer rounded border border-input bg-background p-1 disabled:opacity-40" /><Input dir="ltr" aria-label="قيمة لون الخلفية" disabled={transparent} value={paper} onChange={(event) => { if (/^#[\da-fA-F]{6}$/.test(event.target.value)) setPaper(event.target.value); }} /></div>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" checked={transparent} onChange={(event) => setTransparent(event.target.checked)} className="size-4 accent-primary" /> خلفية شفافة بالكامل</label>

          <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="barcode-scale">دقة الصورة</Label><select id="barcode-scale" value={scale} onChange={(event) => setScale(Number(event.target.value))} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value={3}>عادية</option><option value={5}>عالية</option><option value={8}>جاهزة للطباعة</option></select></div>
            <div className="grid gap-2"><Label htmlFor="barcode-padding">الهامش</Label><Input id="barcode-padding" type="number" min={0} max={20} value={padding} onChange={(event) => setPadding(Math.min(20, Math.max(0, Number(event.target.value) || 0)))} /></div>
            {linear && <>
              <div className="grid gap-2"><Label htmlFor="barcode-height">ارتفاع الأشرطة</Label><Input id="barcode-height" type="number" min={8} max={60} value={height} onChange={(event) => setHeight(Math.min(60, Math.max(8, Number(event.target.value) || 8)))} /></div>
              <label className="flex items-center gap-3 self-end pb-3 text-sm font-medium"><input type="checkbox" checked={showText} onChange={(event) => setShowText(event.target.checked)} className="size-4 accent-primary" /> إظهار الرقم أو النص أسفل الرمز</label>
            </>}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4">
            <h2 className="text-lg font-bold">المعاينة</h2>
            <div className="checker flex min-h-72 items-center justify-center overflow-auto rounded-md border border-border p-5 sm:min-h-96 sm:p-8">
              <canvas ref={canvasRef} role="img" aria-label="معاينة الباركود" className={error ? "hidden" : "block h-auto max-w-full"} />
              {error && <p role="alert" className="max-w-sm text-center text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!!error || !generator} onClick={() => download("png")}><Download /> حفظ PNG</Button>
            <Button type="button" variant="outline" disabled={!!error || !generator} onClick={() => download("svg")}><Download /> حفظ SVG</Button>
          </div>
        </div>
      </div>
    </div>
  );
}