import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Eye,
  FileText,
  FolderDown,
  ImagePlus,
  Loader2,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { toast } from "sonner";

import { PageHeader } from "../../components/PrivacyNote";
import { UploadZone } from "../../components/UploadZone";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { buildPdf, imageToPdfBytes, loadPdf, renderPage } from "../../lib/pdf-tools";
import { downloadBlob, pickDirectory, supportsDirectoryPicker, writeToDirectory } from "../../lib/save";

export const Route = createFileRoute("/tools/pdf")({
  head: () => ({
    meta: [
      { title: "أدوات PDF — تحرير وتحويل الصور | منصة الأستاذ" },
      {
        name: "description",
        content: "أعد ترتيب صفحات PDF واحذفها وأضفها، وحوّل الصور إلى PDF و PDF إلى صور PNG داخل المتصفح.",
      },
      { property: "og:title", content: "أدوات PDF — منصة الأستاذ" },
      { property: "og:description", content: "تحرير PDF وتحويل الصور بدون رفع ملفاتك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PdfTools,
});

type Mode = "edit" | "img2pdf" | "pdf2img";
type Item = { id: string; src: number; index: number; rotation: number; thumb: string; label: string };

const TABS: { id: Mode; label: string }[] = [
  { id: "edit", label: "تحرير PDF" },
  { id: "img2pdf", label: "صور ← PDF" },
  { id: "pdf2img", label: "PDF ← صور PNG" },
];

let uid = 0;
const nid = () => `p${++uid}`;

function PdfTools() {
  const [mode, setMode] = useState<Mode>("edit");
  const sources = useRef<ArrayBuffer[]>([]);
  const docs = useRef<PDFDocumentProxy[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState("");
  const [fit, setFit] = useState<"a4" | "image">("a4");
  const [scale, setScale] = useState(2);
  const [name, setName] = useState("document");
  const [preview, setPreview] = useState<Item | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const reset = () => {
    sources.current = [];
    docs.current = [];
    setItems([]);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    reset();
  };

  async function addSource(bytes: ArrayBuffer, label: string) {
    const doc = await loadPdf(bytes);
    const src = sources.current.push(bytes) - 1;
    docs.current[src] = doc;
    const out: Item[] = [];
    for (let i = 0; i < doc.numPages; i++) {
      const c = await renderPage(doc, i, 0.35);
      out.push({ id: nid(), src, index: i, rotation: 0, thumb: c.toDataURL("image/jpeg", 0.7), label });
    }
    setItems((prev) => [...prev, ...out]);
  }

  async function onFiles(files: File[]) {
    setBusy("جارٍ قراءة الملفات…");
    try {
      for (const f of files) {
        if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
          if (mode === "img2pdf") continue;
          if (sources.current.length === 0) setName(f.name.replace(/\.pdf$/i, ""));
          await addSource(await f.arrayBuffer(), f.name);
        } else if (f.type.startsWith("image/") && mode !== "pdf2img") {
          await addSource(await imageToPdfBytes(f, fit), f.name);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("تعذر قراءة أحد الملفات");
    } finally {
      setBusy("");
    }
  }

  const move = (id: string, dir: -1 | 1) =>
    setItems((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setItems((prev) => {
      const from = prev.findIndex((p) => p.id === dragId);
      const to = prev.findIndex((p) => p.id === targetId);
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
    setDragId(null);
  };

  const rotate = (id: string) =>
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)));
  const remove = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));

  async function exportPdf() {
    if (!items.length) return;
    setBusy("جارٍ إنشاء ملف PDF…");
    try {
      const blob = await buildPdf(sources.current, items);
      downloadBlob(blob, `${name || "document"}.pdf`);
      toast.success("تم حفظ ملف PDF");
    } catch (e) {
      console.error(e);
      toast.error("تعذر إنشاء الملف");
    } finally {
      setBusy("");
    }
  }

  async function exportPngs() {
    if (!items.length) return;
    const dir = supportsDirectoryPicker() ? await pickDirectory() : null;
    try {
      for (let k = 0; k < items.length; k++) {
        setBusy(`جارٍ تحويل الصفحة ${k + 1} من ${items.length}…`);
        const it = items[k];
        const c = await renderPage(docs.current[it.src], it.index, scale, it.rotation);
        const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
        const file = `${name || "page"}-${String(k + 1).padStart(2, "0")}.png`;
        if (dir) await writeToDirectory(dir, file, blob);
        else {
          downloadBlob(blob, file);
          await new Promise((r) => setTimeout(r, 350));
        }
      }
      toast.success(`تم حفظ ${items.length} صورة`);
    } catch (e) {
      console.error(e);
      toast.error("تعذر حفظ الصور");
    } finally {
      setBusy("");
    }
  }

  const accept =
    mode === "img2pdf" ? "image/*" : mode === "pdf2img" ? "application/pdf" : "application/pdf,image/*";

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 pb-28 sm:pb-10">
      <PageHeader
        icon={<FileText className="size-6" />}
        title="أدوات PDF"
        description="حرّر صفحات PDF (ترتيب، حذف، تدوير، إضافة)، وحوّل الصور إلى PDF أو صفحات PDF إلى صور PNG منفصلة."
      />

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-secondary p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchMode(t.id)}
            className={cn(
              "rounded-lg px-2 py-2.5 text-xs font-medium transition-all sm:text-sm",
              mode === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <UploadZone
        accept={accept}
        multiple
        title={
          mode === "img2pdf"
            ? "اسحب الصور هنا أو اضغط للاختيار"
            : mode === "pdf2img"
              ? "اسحب ملف PDF هنا أو اضغط للاختيار"
              : "اسحب ملفات PDF أو صوراً لإضافتها كصفحات"
        }
        hint="يمكنك إضافة المزيد في أي وقت — تُضاف في النهاية"
        onFiles={onFiles}
        className="py-6"
      />

      {/* شريط الأدوات */}
      <div className="sticky top-16 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/95 p-3 shadow-soft backdrop-blur max-sm:fixed max-sm:inset-x-2 max-sm:bottom-2 max-sm:top-auto">
        <span className="text-sm font-medium">{items.length} صفحة</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 w-32 rounded-lg border border-input bg-background px-2 text-sm"
          aria-label="اسم الملف"
        />
        {mode !== "pdf2img" && (
          <select
            value={fit}
            onChange={(e) => setFit(e.target.value as "a4" | "image")}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
            aria-label="مقاس صفحات الصور"
            title="يطبق على الصور المضافة بعد التغيير"
          >
            <option value="a4">الصور على A4</option>
            <option value="image">بمقاس الصورة</option>
          </select>
        )}
        {mode === "pdf2img" && (
          <select
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
            aria-label="الدقة"
          >
            <option value={1}>عادية (72 DPI)</option>
            <option value={2}>عالية (144 DPI)</option>
            <option value={3}>فائقة (216 DPI)</option>
            <option value={4.17}>طباعة (300 DPI)</option>
          </select>
        )}
        <div className="mr-auto flex gap-2">
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="size-4" /> مسح
            </Button>
          )}
          {mode === "pdf2img" ? (
            <Button size="sm" onClick={exportPngs} disabled={!items.length || !!busy}>
              {supportsDirectoryPicker() ? <FolderDown className="size-4" /> : <Download className="size-4" />}
              حفظ الصور PNG
            </Button>
          ) : (
            <Button size="sm" onClick={exportPdf} disabled={!items.length || !!busy}>
              <Download className="size-4" /> حفظ PDF
            </Button>
          )}
        </div>
        {busy && (
          <p className="flex w-full items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> {busy}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">لا توجد صفحات بعد.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((it, i) => (
            <div
              key={it.id}
              draggable
              onDragStart={() => setDragId(it.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(it.id)}
              className={cn(
                "surface group grid gap-2 p-2 transition-all duration-200 animate-in fade-in zoom-in-95",
                dragId === it.id && "opacity-50 ring-2 ring-primary",
              )}
            >
              <button
                onClick={() => setPreview(it)}
                className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded-lg bg-secondary"
                aria-label={`معاينة الصفحة ${i + 1}`}
              >
                <img
                  src={it.thumb}
                  alt=""
                  className="max-h-full max-w-full shadow transition-transform duration-300"
                  style={{ transform: `rotate(${it.rotation}deg)` }}
                />
                <span className="absolute right-1 top-1 rounded-md bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <Eye className="absolute size-6 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
              <p className="truncate text-[11px] text-muted-foreground" title={it.label}>
                {it.label}
              </p>
              <div className="grid grid-cols-4 gap-1">
                <IconBtn label="للأعلى" onClick={() => move(it.id, -1)} disabled={i === 0}>
                  <ArrowUp className="size-4" />
                </IconBtn>
                <IconBtn label="للأسفل" onClick={() => move(it.id, 1)} disabled={i === items.length - 1}>
                  <ArrowDown className="size-4" />
                </IconBtn>
                <IconBtn label="تدوير" onClick={() => rotate(it.id)}>
                  <RotateCw className="size-4" />
                </IconBtn>
                <IconBtn label="حذف" onClick={() => remove(it.id)} danger>
                  <Trash2 className="size-4" />
                </IconBtn>
              </div>
            </div>
          ))}
          {mode !== "pdf2img" && (
            <label className="surface grid aspect-[3/4] cursor-pointer place-items-center gap-2 border-2 border-dashed p-2 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <span className="grid place-items-center gap-2">
                <ImagePlus className="size-7" /> إضافة صفحات
              </span>
              <input
                type="file"
                multiple
                accept={accept}
                className="hidden"
                onChange={(e) => {
                  onFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      )}

      {preview && (
        <PreviewModal
          item={preview}
          doc={docs.current[preview.src]}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 place-items-center rounded-md border border-border transition-colors hover:bg-secondary disabled:opacity-30",
        danger && "text-destructive hover:bg-destructive/10",
      )}
    >
      {children}
    </button>
  );
}

function PreviewModal({ item, doc, onClose }: { item: Item; doc: PDFDocumentProxy; onClose: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    renderPage(doc, item.index, 1.6, item.rotation).then((c) => alive && setUrl(c.toDataURL("image/jpeg", 0.9)));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [doc, item, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/60 p-3 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div className="relative max-h-full max-w-3xl overflow-auto rounded-xl bg-card p-2 shadow-lift animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <Button size="icon" variant="secondary" className="absolute left-3 top-3 z-10" onClick={onClose} aria-label="إغلاق">
          <X className="size-5" />
        </Button>
        {url ? (
          <img src={url} alt="معاينة الصفحة" className="max-h-[85vh] w-auto" />
        ) : (
          <div className="grid h-80 w-64 place-items-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
