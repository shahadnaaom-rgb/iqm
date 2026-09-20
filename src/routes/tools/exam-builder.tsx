import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileDown,
  FilePlus2,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Type,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ExportQuality } from "../../components/ExportQuality";
import { PageHeader } from "../../components/PrivacyNote";
import { BlockToolbar } from "../../components/exam/BlockToolbar";
import { QuestionBlock } from "../../components/exam/QuestionBlock";
import { useFontFamilies } from "../../components/certificate/useFontFamilies";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  A4_H,
  A4_W,
  moveBlockOrder,
  newBlock,
  questionNumbers,
  safeFileName,
  sortBlocks,
  stripHtml,
  type Block,
} from "../../lib/exam";
import { DEFAULT_SCALE, renderNodeToCanvas, canvasToBlob, scaleOf, type ExportScaleId } from "../../lib/export";
import { downloadBlob } from "../../lib/save";
import { SYMBOL_GROUPS } from "../../lib/symbols";

export const Route = createFileRoute("/tools/exam-builder")({
  head: () => ({
    meta: [
      { title: "منضّد الأسئلة — بلوكات قابلة للسحب على A4 — منصة الأستاذ" },
      {
        name: "description",
        content:
          "نضّد أسئلة الامتحان كبلوكات مستقلة: اسحب السؤال، عدّل نصه، غيّر الخط والحجم والمحاذاة، أضف صوراً، وصدّر PDF أو PNG بدقة عالية.",
      },
      { property: "og:title", content: "منضّد الأسئلة — منصة الأستاذ" },
      {
        property: "og:description",
        content: "بلوكات أسئلة قابلة للسحب والتنسيق على ورقة A4 مع تصدير بدقة الطباعة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExamBuilder,
});

const START_BLOCKS: Block[] = [
  newBlock({
    order: 1,
    html: "أجب عن الفروع الآتية:<br>أ) ..................................................<br>ب) ..................................................",
  }),
  newBlock({ order: 2, y: 28, html: "علّل ما يأتي: ..................................................", }),
];

function ExamBuilder() {
  const { families } = useFontFamilies();

  // الرأس
  const [showHeader, setShowHeader] = useState(true);
  const [ministry, setMinistry] = useState("وزارة التربية");
  const [directorate, setDirectorate] = useState("المديرية العامة للتربية");
  const [school, setSchool] = useState("ثانوية النخبة");
  const [examTitle, setExamTitle] = useState("الامتحان الشهري الأول");
  const [subject, setSubject] = useState("الرياضيات");
  const [grade, setGrade] = useState("الصف الخامس العلمي");
  const [duration, setDuration] = useState("ساعة واحدة");
  const [dateText, setDateText] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [headerLine, setHeaderLine] = useState(true);

  // التذييل
  const [showFooter, setShowFooter] = useState(true);
  const [footerText, setFooterText] = useState("مع تمنياتي لكم بالنجاح — مدرس المادة");
  const [footerNote, setFooterNote] = useState("انتهت الأسئلة");
  const [showPageNumber, setShowPageNumber] = useState(true);
  const [footerLine, setFooterLine] = useState(true);

  const [pageCount, setPageCount] = useState(1);
  const [blocks, setBlocks] = useState<Block[]>(START_BLOCKS);
  const [selectedId, setSelectedId] = useState<string | null>(START_BLOCKS[0]!.id);
  const [quality, setQuality] = useState<ExportScaleId>(DEFAULT_SCALE);
  const [busy, setBusy] = useState<null | "png" | "pdf">(null);
  const [exporting, setExporting] = useState(false);

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const areaRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const numbers = useMemo(() => questionNumbers(blocks), [blocks]);
  const ordered = useMemo(() => sortBlocks(blocks), [blocks]);
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const patch = useCallback(
    (id: string, p: Partial<Block>) =>
      setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...p } : b))),
    [],
  );

  // تحريك البلوك المحدّد بالأسهم
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected || selected.locked) return;
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable || target instanceof HTMLInputElement) return;
      const step = e.shiftKey ? 2 : 0.4;
      const map: Record<string, Partial<Block>> = {
        ArrowUp: { y: selected.y - step },
        ArrowDown: { y: selected.y + step },
        ArrowRight: { x: selected.x - step },
        ArrowLeft: { x: selected.x + step },
      };
      const p = map[e.key];
      if (!p) return;
      e.preventDefault();
      patch(selected.id, p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, patch]);

  function addBlock(type: "question" | "text", page = 0) {
    const maxOrder = blocks.reduce((m, b) => Math.max(m, b.order), 0);
    const b = newBlock({
      type,
      page,
      order: maxOrder + 1,
      y: 8 + ((blocks.filter((x) => x.page === page).length * 12) % 70),
      numbered: type === "question",
      html: type === "question" ? "سؤال جديد: ..................................................": "نص حر",
      bold: type === "text",
    });
    setBlocks((prev) => [...prev, b]);
    setSelectedId(b.id);
  }

  function addImageBlock(file: File, page = 0) {
    const reader = new FileReader();
    reader.onload = () => {
      const maxOrder = blocks.reduce((m, b) => Math.max(m, b.order), 0);
      const b = newBlock({
        type: "image",
        page,
        order: maxOrder + 1,
        src: String(reader.result),
        w: 45,
        h: 20,
        y: 40,
        x: 28,
        numbered: false,
      });
      setBlocks((prev) => [...prev, b]);
      setSelectedId(b.id);
      toast.success("أُضيفت الصورة إلى الكانفس");
    };
    reader.readAsDataURL(file);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setSelectedId(null);
  }

  function duplicateBlock(id: string) {
    const src = blocks.find((b) => b.id === id);
    if (!src) return;
    const maxOrder = blocks.reduce((m, b) => Math.max(m, b.order), 0);
    const copy = { ...src, id: newBlock().id, order: maxOrder + 1, y: Math.min(src.y + 8, 92) };
    setBlocks((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  }

  function insertSymbol(symbol: string) {
    if (!selected || selected.type === "image") {
      toast.error("اختر سؤالاً أولاً لإدراج الرمز");
      return;
    }
    const active = document.activeElement as HTMLElement | null;
    if (active?.isContentEditable) {
      document.execCommand("insertText", false, symbol);
      patch(selected.id, { html: active.innerHTML });
      return;
    }
    patch(selected.id, { html: `${selected.html}${symbol}` });
  }

  function onLogo(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function withExportMode<T>(fn: () => Promise<T>) {
    setExporting(true);
    setSelectedId(null);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      return await fn();
    } finally {
      setExporting(false);
    }
  }

  async function exportPng() {
    setBusy("png");
    try {
      await withExportMode(async () => {
        const scale = scaleOf(quality);
        for (let i = 0; i < pageCount; i++) {
          const node = pageRefs.current[i];
          if (!node) continue;
          const canvas = await renderNodeToCanvas(node, scale);
          const blob = await canvasToBlob(canvas, "image/png", 1);
          downloadBlob(blob, `${safeFileName(examTitle)}-${i + 1}.png`);
          await new Promise((r) => setTimeout(r, 150));
        }
      });
      toast.success("تم تصدير الصور بدقة عالية");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التصدير");
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy("pdf");
    try {
      await withExportMode(async () => {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        const scale = Math.max(2, scaleOf(quality));
        for (let i = 0; i < pageCount; i++) {
          const node = pageRefs.current[i];
          if (!node) continue;
          const canvas = await renderNodeToCanvas(node, scale);
          const data = canvas.toDataURL("image/jpeg", 0.98);
          if (i > 0) pdf.addPage();
          pdf.addImage(data, "JPEG", 0, 0, 210, 297);
        }
        pdf.save(`${safeFileName(examTitle)}.pdf`);
      });
      toast.success("تم تصدير ملف PDF بجودة الطباعة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التصدير");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10">
      <PageHeader
        icon={<Wand2 className="size-6" />}
        title="منضّد الأسئلة"
        description="كل سؤال بلوك مستقل: اضغط عليه ليتحدد، عدّل نصه مباشرة، اسحبه لأي مكان، غيّر الخط والحجم والمحاذاة، وأضف صوراً — ثم صدّر PDF أو PNG بدقة عالية."
      />

      <div className="flex flex-wrap items-end gap-2">
        <Button onClick={exportPdf} disabled={busy !== null}>
          {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          تصدير PDF
        </Button>
        <Button variant="outline" onClick={exportPng} disabled={busy !== null}>
          {busy === "png" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          تصدير PNG
        </Button>
        <ExportQuality value={quality} onChange={setQuality} />
        <Button variant="outline" onClick={() => addBlock("question")}>
          <Plus className="size-4" /> سؤال
        </Button>
        <Button variant="outline" onClick={() => addBlock("text")}>
          <Type className="size-4" /> نص حر
        </Button>
        <Button variant="outline" onClick={() => fileInput.current?.click()}>
          <ImageIcon className="size-4" /> صورة
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) addImageBlock(f);
            e.target.value = "";
          }}
        />
        <Button variant="outline" onClick={() => setPageCount((c) => c + 1)}>
          <FilePlus2 className="size-4" /> صفحة جديدة
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="grid gap-4 self-start">
          {selected ? (
            <BlockToolbar
              block={selected}
              families={families}
              onChange={(p) => patch(selected.id, p)}
              onDuplicate={() => duplicateBlock(selected.id)}
              onRemove={() => removeBlock(selected.id)}
            />
          ) : (
            <div className="surface p-4 text-sm text-muted-foreground">
              اضغط على أي سؤال في الورقة ليظهر شريط التنسيق الخاص به.
            </div>
          )}

          {/* ترتيب الأسئلة */}
          <div className="surface grid gap-2 p-4">
            <h2 className="font-display font-bold">ترتيب العناصر</h2>
            {ordered.map((b) => (
              <div
                key={b.id}
                className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${
                  selectedId === b.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(b.id)}
                  className="min-w-0 flex-1 truncate text-right"
                >
                  {b.type === "image"
                    ? "🖼 صورة"
                    : `${numbers.get(b.id) ? `س${numbers.get(b.id)} · ` : ""}${stripHtml(b.html).slice(0, 28) || "بلوك فارغ"}`}
                  <span className="text-muted-foreground"> — ص{b.page + 1}</span>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="أعلى"
                  onClick={() => setBlocks((prev) => moveBlockOrder(prev, b.id, -1))}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="أسفل"
                  onClick={() => setBlocks((prev) => moveBlockOrder(prev, b.id, 1))}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="حذف" onClick={() => removeBlock(b.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {/* الرموز */}
          <div className="surface grid gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold">الرموز الشائعة</h2>
              <span className="text-xs text-muted-foreground">تُدرج في البلوك المحدّد</span>
            </div>
            <Tabs defaultValue={SYMBOL_GROUPS[0]?.id ?? "math"}>
              <TabsList className="flex h-auto w-full flex-wrap justify-start">
                {SYMBOL_GROUPS.map((g) => (
                  <TabsTrigger key={g.id} value={g.id} className="text-xs">
                    {g.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {SYMBOL_GROUPS.map((g) => (
                <TabsContent key={g.id} value={g.id} className="mt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((item) => (
                      <button
                        key={g.id + item.s + item.t}
                        type="button"
                        title={item.t}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertSymbol(item.s)}
                        className="min-w-9 rounded-lg border border-border bg-card px-2 py-1.5 text-sm transition-colors hover:bg-primary hover:text-primary-foreground"
                      >
                        {item.s}
                      </button>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* إعدادات الرأس */}
          <div className="surface grid gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold">رأس الصفحة</h2>
              <Switch checked={showHeader} onCheckedChange={setShowHeader} aria-label="إظهار الرأس" />
            </div>
            {showHeader && (
              <div className="grid gap-3">
                <Field label="الوزارة" value={ministry} onChange={setMinistry} />
                <Field label="المديرية" value={directorate} onChange={setDirectorate} />
                <Field label="المدرسة" value={school} onChange={setSchool} />
                <Field label="عنوان الامتحان" value={examTitle} onChange={setExamTitle} />
                <Field label="المادة" value={subject} onChange={setSubject} />
                <Field label="الصف" value={grade} onChange={setGrade} />
                <Field label="الزمن" value={duration} onChange={setDuration} />
                <Field label="التاريخ" value={dateText} onChange={setDateText} />
                <div className="grid gap-2">
                  <Label>شعار (اختياري)</Label>
                  <Input type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0])} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>خط فاصل تحت الرأس</Label>
                  <Switch checked={headerLine} onCheckedChange={setHeaderLine} />
                </div>
              </div>
            )}
          </div>

          {/* إعدادات التذييل */}
          <div className="surface grid gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold">تذييل الصفحة</h2>
              <Switch checked={showFooter} onCheckedChange={setShowFooter} aria-label="إظهار التذييل" />
            </div>
            {showFooter && (
              <div className="grid gap-3">
                <Field label="نص التذييل" value={footerText} onChange={setFooterText} />
                <Field label="ملاحظة أخيرة" value={footerNote} onChange={setFooterNote} />
                <div className="flex items-center justify-between">
                  <Label>رقم الصفحة</Label>
                  <Switch checked={showPageNumber} onCheckedChange={setShowPageNumber} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>خط فاصل فوق التذييل</Label>
                  <Switch checked={footerLine} onCheckedChange={setFooterLine} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* الصفحات */}
        <div className="grid gap-8 overflow-x-auto">
          {Array.from({ length: pageCount }).map((_, pageIndex) => (
            <div key={pageIndex} className="grid gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">صفحة {pageIndex + 1}</span>
                <Button size="sm" variant="ghost" onClick={() => addBlock("question", pageIndex)}>
                  <Plus className="size-4" /> سؤال هنا
                </Button>
                {pageCount > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setBlocks((prev) =>
                        prev
                          .filter((b) => b.page !== pageIndex)
                          .map((b) => (b.page > pageIndex ? { ...b, page: b.page - 1 } : b)),
                      );
                      setPageCount((c) => c - 1);
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" /> حذف الصفحة
                  </Button>
                )}
              </div>

              <div
                ref={(el) => {
                  pageRefs.current[pageIndex] = el;
                }}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) setSelectedId(null);
                }}
                style={{ width: A4_W, height: A4_H }}
                className="relative shrink-0 bg-white text-black shadow-lift"
                dir="rtl"
              >
                <div className="flex h-full flex-col p-[48px]">
                  {showHeader && (
                    <header className={`grid gap-1 pb-3 ${headerLine ? "border-b-2 border-black" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid text-[14px] leading-6">
                          <span>{ministry}</span>
                          <span>{directorate}</span>
                          <span>{school}</span>
                        </div>
                        {logo && <img src={logo} alt="" className="h-16 w-16 object-contain" />}
                        <div className="grid text-left text-[14px] leading-6">
                          <span>المادة: {subject}</span>
                          <span>الصف: {grade}</span>
                          <span>الزمن: {duration}</span>
                          {dateText && <span>التاريخ: {dateText}</span>}
                        </div>
                      </div>
                      <h1 className="pt-1 text-center text-[20px] font-bold">{examTitle}</h1>
                    </header>
                  )}

                  <div
                    ref={(el) => {
                      areaRefs.current[pageIndex] = el;
                    }}
                    className="relative flex-1"
                  >
                    {ordered
                      .filter((b) => b.page === pageIndex)
                      .map((b) => (
                        <QuestionBlock
                          key={b.id}
                          block={b}
                          number={numbers.get(b.id)}
                          selected={selectedId === b.id}
                          exporting={exporting}
                          getRect={() => areaRefs.current[pageIndex]?.getBoundingClientRect() ?? null}
                          onSelect={() => setSelectedId(b.id)}
                          onChange={(p) => patch(b.id, p)}
                        />
                      ))}
                  </div>

                  {showFooter && (
                    <footer
                      className={`grid gap-1 pt-3 text-[13px] ${footerLine ? "border-t-2 border-black" : ""}`}
                    >
                      {footerNote && <p className="text-center font-bold">{footerNote}</p>}
                      <div className="flex items-center justify-between">
                        <span>{footerText}</span>
                        {showPageNumber && (
                          <span>
                            صفحة {pageIndex + 1} من {pageCount}
                          </span>
                        )}
                      </div>
                    </footer>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} dir="rtl" />
    </div>
  );
}
