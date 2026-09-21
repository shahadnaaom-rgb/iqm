import { createFileRoute } from "@tanstack/react-router";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileDown,
  FilePlus2,
  GripVertical,
  ImagePlus,
  Italic,
  LayoutGrid,
  Loader2,
  Plus,
  Trash2,
  Underline,
  Wand2,
} from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "../../components/PrivacyNote";
import { useFontFamilies } from "../../components/certificate/useFontFamilies";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Textarea } from "../../components/ui/textarea";
import { downloadBlob } from "../../lib/save";
import { SYMBOL_GROUPS } from "../../lib/symbols";

export const Route = createFileRoute("/tools/exam-builder")({
  head: () => ({
    meta: [
      { title: "منضّد الأسئلة والامتحانات — منصة الأستاذ" },
      {
        name: "description",
        content:
          "أنشئ ورقة امتحان A4 من كتل أسئلة قابلة للتحرير والسحب، مع تنسيق النص والصور والتصدير PDF أو PNG.",
      },
      { property: "og:title", content: "منضّد الأسئلة والامتحانات — منصة الأستاذ" },
      {
        property: "og:description",
        content: "محرر عربي لكتل الأسئلة والصور مع تخطيط مرن وتجهيز كامل للطباعة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExamBuilder,
});

const A4_W = 794;
const A4_H = 1123;

type TextAlign = "right" | "center" | "left";
/** x/y/w للتحريك الحر، و ca = محاذاة الكتلة نفسها بالنسبة للورقة */
type FreePos = { x?: number; y?: number; w?: number; ca?: TextAlign };
type QuestionBlock = FreePos & {
  id: string;
  type: "question";
  html: string;
  fontFamily: string;
  fontSize: number;
  align: TextAlign;
};
type ImageBlock = FreePos & {
  id: string;
  type: "image";
  src: string;
  alt: string;
  width: number;
  align: TextAlign;
};
type ExamBlock = QuestionBlock | ImageBlock;
type ExamPage = { id: string; blocks: ExamBlock[] };
type DraggedBlock = { pageId: string; blockId: string };
type ExportFormat = "png" | "jpeg" | "webp" | "pdf";

const EXPORT_FORMATS: { id: ExportFormat; name: string }[] = [
  { id: "pdf", name: "PDF (كل الصفحات)" },
  { id: "png", name: "صورة PNG" },
  { id: "jpeg", name: "صورة JPG" },
  { id: "webp", name: "صورة WEBP" },
];
const EXPORT_SCALES: { id: number; name: string }[] = [
  { id: 1.5, name: "عادية (~110 نقطة/إنش)" },
  { id: 2, name: "جيدة (~150 نقطة/إنش)" },
  { id: 3, name: "عالية (~225 نقطة/إنش)" },
  { id: 4, name: "فائقة (~300 نقطة/إنش)" },
  { id: 6, name: "قصوى (~450 نقطة/إنش)" },
];

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const newQuestion = (html = "اكتب نص السؤال هنا..."): QuestionBlock => ({
  id: makeId(),
  type: "question",
  html,
  fontFamily: "Cairo",
  fontSize: 17,
  align: "right",
});
const firstPage = (): ExamPage => ({
  id: makeId(),
  blocks: [
    newQuestion("عرّف المفهوم الآتي، ثم اذكر مثالاً واحداً."),
    newQuestion("أجب عن اثنين فقط من الأسئلة الآتية:<br>أ) ........................................<br>ب) ........................................"),
    newQuestion("اختر الإجابة الصحيحة من بين البدائل المتاحة."),
  ],
});

function ExamBuilder() {
  const { families } = useFontFamilies();
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
  const [showFooter, setShowFooter] = useState(true);
  const [footerText, setFooterText] = useState("مع تمنياتي لكم بالنجاح — مدرس المادة");
  const [footerNote, setFooterNote] = useState("انتهت الأسئلة");
  const [showPageNumber, setShowPageNumber] = useState(true);
  const [footerLine, setFooterLine] = useState(true);
  const [columns, setColumns] = useState<1 | 2>(1);
  const [freeMode, setFreeMode] = useState(false);
  const [marginX, setMarginX] = useState(44);
  const [marginY, setMarginY] = useState(40);
  const [headerSpace, setHeaderSpace] = useState(120);
  const [footerSpace, setFooterSpace] = useState(70);
  const [headerImageRight, setHeaderImageRight] = useState<string | null>(null);
  const [headerImageLeft, setHeaderImageLeft] = useState<string | null>(null);
  const [headerImageSize, setHeaderImageSize] = useState(56);
  const [logoSize, setLogoSize] = useState(56);
  const [footerImage, setFooterImage] = useState<string | null>(null);
  const [footerImageSize, setFooterImageSize] = useState(48);
  const [footerImageAlign, setFooterImageAlign] = useState<TextAlign>("center");
  const [pages, setPages] = useState<ExamPage[]>([firstPage()]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragged, setDragged] = useState<DraggedBlock | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [exportScale, setExportScale] = useState(3);

  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const wrapRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const imageInput = useRef<HTMLInputElement | null>(null);
  const freeDrag = useRef<
    | null
    | { id: string; pageId: string; startX: number; startY: number; originX: number; originY: number }
  >(null);

  const selectedBlock = pages.flatMap((page) => page.blocks).find((block) => block.id === selectedId);

  // تفعيل/إلغاء التحريك الحر مع الحفاظ على مواقع الكتل الحالية
  const toggleFreeMode = (enabled: boolean) => {
    if (enabled) {
      setPages((current) =>
        current.map((page) => {
          const wrap = wrapRefs.current[page.id];
          const wrapBox = wrap?.getBoundingClientRect();
          return {
            ...page,
            blocks: page.blocks.map((block, index) => {
              const node = blockRefs.current[block.id];
              if (!wrapBox || !node || wrapBox.width === 0 || wrapBox.height === 0) {
                return { ...block, x: 4, y: index * 12, w: 92 };
              }
              const box = node.getBoundingClientRect();
              return {
                ...block,
                x: ((wrapBox.right - box.right) / wrapBox.width) * 100,
                y: ((box.top - wrapBox.top) / wrapBox.height) * 100,
                w: (box.width / wrapBox.width) * 100,
              };
            }),
          };
        }),
      );
    }
    setFreeMode(enabled);
  };

  const onFreePointerDown = (event: ReactPointerEvent, pageId: string, block: ExamBlock) => {
    if (!freeMode) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(block.id);
    freeDrag.current = {
      id: block.id,
      pageId,
      startX: event.clientX,
      startY: event.clientY,
      originX: block.x ?? 4,
      originY: block.y ?? 0,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onFreePointerMove = (event: ReactPointerEvent, pageId: string) => {
    const drag = freeDrag.current;
    if (!drag || drag.id === undefined) return;
    const wrap = wrapRefs.current[pageId];
    if (!wrap) return;
    const box = wrap.getBoundingClientRect();
    const dx = ((drag.startX - event.clientX) / box.width) * 100; // RTL: يمين ← يسار
    const dy = ((event.clientY - drag.startY) / box.height) * 100;
    const block = pages.flatMap((item) => item.blocks).find((item) => item.id === drag.id);
    const width = block?.w ?? 92;
    const x = Math.min(Math.max(0, 100 - width), Math.max(0, drag.originX + dx));
    const y = Math.min(97, Math.max(0, drag.originY + dy));
    patchBlock(drag.id, { x, y });
  };

  const endFreeDrag = () => {
    freeDrag.current = null;
  };

  const patchBlock = (id: string, patch: Partial<QuestionBlock> | Partial<ImageBlock>) => {
    setPages((current) =>
      current.map((page) => ({
        ...page,
        blocks: page.blocks.map((block) =>
          block.id === id ? ({ ...block, ...patch } as ExamBlock) : block,
        ),
      })),
    );
  };

  /** محاذاة الكتلة نفسها بالنسبة للورقة، مع الحفاظ على محاذاة النص داخلها */
  const alignBlockToPage = (block: ExamBlock, side: TextAlign) => {
    const width = block.w ?? (freeMode ? 92 : 100);
    const x = side === "right" ? 0 : side === "center" ? (100 - width) / 2 : 100 - width;
    patchBlock(block.id, freeMode ? { ca: side, w: width, x } : { ca: side, w: width });
  };

  const addQuestion = (pageId = pages[0]?.id) => {
    if (!pageId) return;
    const question = newQuestion();
    setPages((current) =>
      current.map((page) =>
        page.id === pageId ? { ...page, blocks: [...page.blocks, question] } : page,
      ),
    );
    setSelectedId(question.id);
    requestAnimationFrame(() => editorRefs.current[question.id]?.focus());
  };

  const duplicateBlock = (id: string) => {
    setPages((current) =>
      current.map((page) => {
        const index = page.blocks.findIndex((block) => block.id === id);
        if (index < 0) return page;
        const source = page.blocks[index];
        if (!source) return page;
        const copy = { ...source, id: makeId() };
        const blocks = [...page.blocks];
        blocks.splice(index + 1, 0, copy);
        setSelectedId(copy.id);
        return { ...page, blocks };
      }),
    );
  };

  const removeBlock = (id: string) => {
    setPages((current) =>
      current.map((page) => ({ ...page, blocks: page.blocks.filter((block) => block.id !== id) })),
    );
    setSelectedId(null);
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    setPages((current) =>
      current.map((page) => {
        const index = page.blocks.findIndex((block) => block.id === id);
        const destination = index + direction;
        if (index < 0 || destination < 0 || destination >= page.blocks.length) return page;
        const blocks = [...page.blocks];
        const moving = blocks[index];
        const replacing = blocks[destination];
        if (!moving || !replacing) return page;
        blocks[index] = replacing;
        blocks[destination] = moving;
        return { ...page, blocks };
      }),
    );
  };

  const dropBlock = (targetPageId: string, targetBlockId?: string) => {
    if (!dragged) return;
    let moving: ExamBlock | undefined;
    pages.forEach((page) => {
      if (page.id === dragged.pageId) moving = page.blocks.find((block) => block.id === dragged.blockId);
    });
    if (!moving || moving.id === targetBlockId) {
      setDragged(null);
      setDropTarget(null);
      return;
    }
    setPages((current) => {
      const without = current.map((page) => ({
        ...page,
        blocks: page.blocks.filter((block) => block.id !== moving?.id),
      }));
      return without.map((page) => {
        if (page.id !== targetPageId || !moving) return page;
        const blocks = [...page.blocks];
        const targetIndex = targetBlockId
          ? blocks.findIndex((block) => block.id === targetBlockId)
          : blocks.length;
        blocks.splice(targetIndex < 0 ? blocks.length : targetIndex, 0, moving);
        return { ...page, blocks };
      });
    });
    setDragged(null);
    setDropTarget(null);
  };

  const format = (command: "bold" | "italic" | "underline") => {
    if (!selectedBlock || selectedBlock.type !== "question") return;
    editorRefs.current[selectedBlock.id]?.focus();
    document.execCommand(command);
    const html = editorRefs.current[selectedBlock.id]?.innerHTML;
    if (html !== undefined) patchBlock(selectedBlock.id, { html });
  };

  const insertSymbol = (symbol: string) => {
    if (!selectedBlock || selectedBlock.type !== "question") {
      toast.error("حدد سؤالاً أولاً");
      return;
    }
    editorRefs.current[selectedBlock.id]?.focus();
    document.execCommand("insertText", false, symbol);
    const html = editorRefs.current[selectedBlock.id]?.innerHTML;
    if (html !== undefined) patchBlock(selectedBlock.id, { html });
  };

  const onImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const pageId = pages.find((page) => page.blocks.some((block) => block.id === selectedId))?.id ?? pages[0]?.id;
      if (!pageId) return;
      const block: ImageBlock = {
        id: makeId(),
        type: "image",
        src: String(reader.result),
        alt: file.name,
        width: 60,
        align: "center",
      };
      setPages((current) =>
        current.map((page) =>
          page.id === pageId ? { ...page, blocks: [...page.blocks, block] } : page,
        ),
      );
      setSelectedId(block.id);
      if (imageInput.current) imageInput.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  const readImage = (file: File | undefined, apply: (dataUrl: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => apply(String(reader.result));
    reader.readAsDataURL(file);
  };
  const onLogo = (file?: File) => readImage(file, setLogo);

  const addPage = () => {
    const page = { id: makeId(), blocks: [newQuestion()] };
    setPages((current) => [...current, page]);
    setSelectedId(page.blocks[0]?.id ?? null);
    toast.success("أُضيفت صفحة جديدة");
  };

  const removePage = (pageId: string) => {
    if (pages.length === 1) {
      toast.error("لا يمكن حذف الصفحة الوحيدة");
      return;
    }
    setPages((current) => current.filter((page) => page.id !== pageId));
    setSelectedId(null);
  };

  const renderPage = async (pageId: string, scale: number) => {
    const node = pageRefs.current[pageId];
    if (!node) throw new Error("الصفحة غير جاهزة");
    const { default: html2canvas } = await import("html2canvas-pro");
    return html2canvas(node, { scale, backgroundColor: "#ffffff", useCORS: true });
  };

  const runExport = async () => {
    setBusy(true);
    const previous = selectedId;
    setSelectedId(null);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      const baseName = examTitle || "أسئلة";
      if (exportFormat === "pdf") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        for (let index = 0; index < pages.length; index += 1) {
          const page = pages[index];
          if (!page) continue;
          const canvas = await renderPage(page.id, exportScale);
          if (index > 0) pdf.addPage();
          pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", 0, 0, 210, 297, undefined, "FAST");
        }
        pdf.save(`${baseName}.pdf`);
        toast.success("تم تصدير ملف PDF");
      } else {
        const mime = `image/${exportFormat}` as const;
        const extension = exportFormat === "jpeg" ? "jpg" : exportFormat;
        for (let index = 0; index < pages.length; index += 1) {
          const page = pages[index];
          if (!page) continue;
          const canvas = await renderPage(page.id, exportScale);
          const blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (result) => (result ? resolve(result) : reject(new Error("فشل التصدير"))),
              mime,
              exportFormat === "png" ? 1 : 0.96,
            ),
          );
          downloadBlob(blob, `${baseName}-${index + 1}-${canvas.width}x${canvas.height}.${extension}`);
        }
        toast.success("تم تصدير الصور بالدقة المختارة");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر التصدير");
    } finally {
      setSelectedId(previous);
      setBusy(false);
    }
  };

  let questionNumber = 0;

  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-8">
      <PageHeader
        icon={<Wand2 className="size-6" />}
        title="منضّد الأسئلة"
        description="رتّب ورقة الامتحان من كتل أسئلة وصور؛ حدّد أي كتلة وعدّلها مباشرة أو اسحبها إلى موضع جديد."
      />

      <div className="surface sticky top-3 z-30 flex flex-wrap items-center gap-2 p-2.5">
        <Button onClick={runExport} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : exportFormat === "pdf" ? <FileDown className="size-4" /> : <Download className="size-4" />}
          تصدير
        </Button>
        <select
          value={exportFormat}
          onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          aria-label="صيغة التصدير"
        >
          {EXPORT_FORMATS.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <select
          value={exportScale}
          onChange={(event) => setExportScale(Number(event.target.value))}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          aria-label="دقة التصدير"
        >
          {EXPORT_SCALES.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {Math.round(A4_W * exportScale)}×{Math.round(A4_H * exportScale)} بكسل
        </span>
        <Button variant="outline" onClick={() => addQuestion()}>
          <Plus className="size-4" /> سؤال
        </Button>
        <Button variant="outline" onClick={() => imageInput.current?.click()}>
          <ImagePlus className="size-4" /> صورة
        </Button>
        <input ref={imageInput} className="hidden" type="file" accept="image/*" onChange={(event) => onImage(event.target.files?.[0])} />
        <Button variant="outline" onClick={addPage}>
          <FilePlus2 className="size-4" /> صفحة
        </Button>

        <div className="mx-1 h-7 w-px bg-border" />
        <Button variant="ghost" size="icon" onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")} disabled={selectedBlock?.type !== "question"} aria-label="عريض" title="عريض">
          <Bold className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onMouseDown={(event) => event.preventDefault()} onClick={() => format("italic")} disabled={selectedBlock?.type !== "question"} aria-label="مائل" title="مائل">
          <Italic className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onMouseDown={(event) => event.preventDefault()} onClick={() => format("underline")} disabled={selectedBlock?.type !== "question"} aria-label="تحته خط" title="تحته خط">
          <Underline className="size-4" />
        </Button>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="grid gap-4 xl:sticky xl:top-24">
          <div className="surface grid gap-4 p-4">
            <div className="flex items-center gap-2">
              <LayoutGrid className="size-4 text-primary" />
              <h2 className="font-display font-bold">الكتلة المحددة</h2>
            </div>
            {!selectedBlock ? (
              <p className="text-sm leading-7 text-muted-foreground">اضغط على سؤال أو صورة داخل الورقة لتظهر أدواتها هنا.</p>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                  <span>{selectedBlock.type === "question" ? "سؤال نصي" : "صورة"}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => moveBlock(selectedBlock.id, -1)} aria-label="تحريك لأعلى" title="تحريك لأعلى"><ChevronUp className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => moveBlock(selectedBlock.id, 1)} aria-label="تحريك لأسفل" title="تحريك لأسفل"><ChevronDown className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => duplicateBlock(selectedBlock.id)} aria-label="نسخ" title="نسخ"><Copy className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => removeBlock(selectedBlock.id)} aria-label="حذف" title="حذف"><Trash2 className="size-4" /></Button>
                  </div>
                </div>
                {selectedBlock.type === "question" ? (
                  <>
                    <div className="grid gap-1.5">
                      <Label>نوع الخط</Label>
                      <Select value={selectedBlock.fontFamily} onValueChange={(fontFamily) => patchBlock(selectedBlock.id, { fontFamily })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{families.map((font) => <SelectItem key={font.family} value={font.family}><span style={{ fontFamily: font.family }}>{font.label}</span></SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="question-font-size">حجم الخط: {selectedBlock.fontSize}px</Label>
                      <input id="question-font-size" className="accent-primary" type="range" min={11} max={34} value={selectedBlock.fontSize} onChange={(event) => patchBlock(selectedBlock.id, { fontSize: Number(event.target.value) })} />
                    </div>
                  </>
                ) : (
                  <div className="grid gap-1.5">
                    <Label htmlFor="image-width">حجم الصورة: {selectedBlock.width}%</Label>
                    <input id="image-width" className="accent-primary" type="range" min={20} max={100} value={selectedBlock.width} onChange={(event) => patchBlock(selectedBlock.id, { width: Number(event.target.value) })} />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label>محاذاة النص داخل الكتلة</Label>
                  <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                    {(["right", "center", "left"] as TextAlign[]).map((align) => {
                      const Icon = align === "right" ? AlignRight : align === "center" ? AlignCenter : AlignLeft;
                      return <Button key={align} variant={selectedBlock.align === align ? "default" : "ghost"} size="sm" onClick={() => patchBlock(selectedBlock.id, { align })} aria-label={`محاذاة ${align}`}><Icon className="size-4" /></Button>;
                    })}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>محاذاة الكتلة بالنسبة للورقة</Label>
                  <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                    {(["right", "center", "left"] as TextAlign[]).map((side) => {
                      const Icon = side === "right" ? AlignRight : side === "center" ? AlignCenter : AlignLeft;
                      const active = (selectedBlock.ca ?? "right") === side;
                      return <Button key={side} variant={active ? "default" : "ghost"} size="sm" onClick={() => alignBlockToPage(selectedBlock, side)} aria-label={`محاذاة الكتلة ${side}`}><Icon className="size-4" /></Button>;
                    })}
                  </div>
                  <p className="text-xs leading-6 text-muted-foreground">مستقلة عن محاذاة النص؛ اضبط عرض الكتلة لتظهر النتيجة.</p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="block-width">عرض الكتلة: {Math.round(selectedBlock.w ?? (freeMode ? 92 : 100))}%</Label>
                  <input id="block-width" className="accent-primary" type="range" min={15} max={100} value={Math.round(selectedBlock.w ?? (freeMode ? 92 : 100))} onChange={(event) => patchBlock(selectedBlock.id, { w: Number(event.target.value) })} />
                </div>
              </>
            )}
          </div>

          <div className="surface grid gap-3 p-4">
            <h2 className="font-display font-bold">تخطيط الورقة</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" disabled={freeMode} variant={columns === 1 ? "default" : "outline"} onClick={() => setColumns(1)}>عمود واحد</Button>
              <Button size="sm" disabled={freeMode} variant={columns === 2 ? "default" : "outline"} onClick={() => setColumns(2)}>عمودان</Button>
            </div>
            <label className="flex items-center justify-between text-sm">
              تحريك الأسئلة بحرية
              <Switch checked={freeMode} onCheckedChange={toggleFreeMode} />
            </label>
            <p className="text-xs leading-6 text-muted-foreground">
              {freeMode
                ? "اسحب الكتلة من أي مكان فيها لتضعها حيث تشاء داخل الورقة، وتحكّم بعرضها من الأسفل."
                : "الترتيب تلقائي من الأعلى للأسفل؛ فعّل التحريك الحر لوضع كل سؤال في المكان الذي تريده."}
            </p>
          </div>

          <div className="surface grid gap-3 p-4">
            <h2 className="font-display font-bold">مساحات الصفحة</h2>
            <div className="grid gap-1.5">
              <Label htmlFor="margin-x">هامش الجانبين: {marginX}px</Label>
              <input id="margin-x" className="accent-primary" type="range" min={10} max={120} value={marginX} onChange={(event) => setMarginX(Number(event.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="margin-y">هامش الأعلى والأسفل: {marginY}px</Label>
              <input id="margin-y" className="accent-primary" type="range" min={10} max={120} value={marginY} onChange={(event) => setMarginY(Number(event.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="header-space">مساحة الرأس: {headerSpace}px</Label>
              <input id="header-space" className="accent-primary" type="range" min={0} max={320} step={5} value={headerSpace} onChange={(event) => setHeaderSpace(Number(event.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="footer-space">مساحة التذييل: {footerSpace}px</Label>
              <input id="footer-space" className="accent-primary" type="range" min={0} max={250} step={5} value={footerSpace} onChange={(event) => setFooterSpace(Number(event.target.value))} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setMarginX(44); setMarginY(40); setHeaderSpace(120); setFooterSpace(70); }}>إرجاع القياسات الافتراضية</Button>
          </div>

          <div className="surface grid gap-3 p-4">
            <div className="flex items-center justify-between"><h2 className="font-display font-bold">رأس الورقة</h2><Switch checked={showHeader} onCheckedChange={setShowHeader} /></div>
            {showHeader && <div className="grid gap-3">
              <Field label="الوزارة" value={ministry} onChange={setMinistry} />
              <Field label="المديرية" value={directorate} onChange={setDirectorate} />
              <Field label="المدرسة" value={school} onChange={setSchool} />
              <Field label="عنوان الامتحان" value={examTitle} onChange={setExamTitle} />
              <Field label="المادة" value={subject} onChange={setSubject} />
              <Field label="الصف" value={grade} onChange={setGrade} />
              <Field label="الزمن" value={duration} onChange={setDuration} />
              <Field label="التاريخ" value={dateText} onChange={setDateText} />
              <div className="grid gap-1.5"><Label className="text-xs">شعار وسط الرأس</Label><Input type="file" accept="image/*" onChange={(event) => onLogo(event.target.files?.[0])} /></div>
              {logo && <>
                <div className="grid gap-1.5"><Label htmlFor="logo-size" className="text-xs">حجم الشعار: {logoSize}px</Label><input id="logo-size" className="accent-primary" type="range" min={24} max={140} value={logoSize} onChange={(event) => setLogoSize(Number(event.target.value))} /></div>
                <Button variant="ghost" size="sm" onClick={() => setLogo(null)}><Trash2 className="size-4" /> إزالة الشعار</Button>
              </>}
              <div className="grid gap-1.5"><Label className="text-xs">صورة يمين الرأس</Label><Input type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0], setHeaderImageRight)} /></div>
              {headerImageRight && <Button variant="ghost" size="sm" onClick={() => setHeaderImageRight(null)}><Trash2 className="size-4" /> إزالة صورة اليمين</Button>}
              <div className="grid gap-1.5"><Label className="text-xs">صورة يسار الرأس</Label><Input type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0], setHeaderImageLeft)} /></div>
              {headerImageLeft && <Button variant="ghost" size="sm" onClick={() => setHeaderImageLeft(null)}><Trash2 className="size-4" /> إزالة صورة اليسار</Button>}
              {(headerImageRight || headerImageLeft) && <div className="grid gap-1.5"><Label htmlFor="header-image-size" className="text-xs">حجم صور الرأس: {headerImageSize}px</Label><input id="header-image-size" className="accent-primary" type="range" min={20} max={140} value={headerImageSize} onChange={(event) => setHeaderImageSize(Number(event.target.value))} /></div>}
              <label className="flex items-center justify-between text-xs">خط فاصل أسفل الرأس<Switch checked={headerLine} onCheckedChange={setHeaderLine} /></label>
            </div>}
          </div>

          <div className="surface grid gap-3 p-4">
            <div className="flex items-center justify-between"><h2 className="font-display font-bold">تذييل الورقة</h2><Switch checked={showFooter} onCheckedChange={setShowFooter} /></div>
            {showFooter && <div className="grid gap-3">
              <Field label="سطر الختام" value={footerNote} onChange={setFooterNote} />
              <div className="grid gap-1.5"><Label className="text-xs">نص التذييل</Label><Textarea value={footerText} onChange={(event) => setFooterText(event.target.value)} rows={2} /></div>
              <div className="grid gap-1.5"><Label className="text-xs">صورة أو ختم في التذييل</Label><Input type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0], setFooterImage)} /></div>
              {footerImage && <>
                <div className="grid gap-1.5"><Label htmlFor="footer-image-size" className="text-xs">حجم الصورة: {footerImageSize}px</Label><input id="footer-image-size" className="accent-primary" type="range" min={20} max={160} value={footerImageSize} onChange={(event) => setFooterImageSize(Number(event.target.value))} /></div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">محاذاة الصورة</Label>
                  <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                    {(["right", "center", "left"] as TextAlign[]).map((side) => {
                      const Icon = side === "right" ? AlignRight : side === "center" ? AlignCenter : AlignLeft;
                      return <Button key={side} variant={footerImageAlign === side ? "default" : "ghost"} size="sm" onClick={() => setFooterImageAlign(side)} aria-label={`محاذاة صورة التذييل ${side}`}><Icon className="size-4" /></Button>;
                    })}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFooterImage(null)}><Trash2 className="size-4" /> إزالة الصورة</Button>
              </>}
              <label className="flex items-center justify-between text-xs">إظهار رقم الصفحة<Switch checked={showPageNumber} onCheckedChange={setShowPageNumber} /></label>
              <label className="flex items-center justify-between text-xs">خط فاصل أعلى التذييل<Switch checked={footerLine} onCheckedChange={setFooterLine} /></label>
            </div>}
          </div>

          <div className="surface grid gap-3 p-4">
            <div className="flex items-center justify-between"><h2 className="font-display font-bold">الرموز الشائعة</h2><span className="text-xs text-muted-foreground">للسؤال المحدد</span></div>
            <Tabs defaultValue={SYMBOL_GROUPS[0]?.id ?? "math"}>
              <TabsList className="flex h-auto w-full flex-wrap justify-start">{SYMBOL_GROUPS.map((group) => <TabsTrigger key={group.id} value={group.id} className="text-xs">{group.label}</TabsTrigger>)}</TabsList>
              {SYMBOL_GROUPS.map((group) => <TabsContent key={group.id} value={group.id} className="mt-3"><div className="flex flex-wrap gap-1.5">{group.items.map((item) => <Button key={group.id + item.s + item.t} type="button" title={item.t} variant="outline" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={() => insertSymbol(item.s)}>{item.s}</Button>)}</div></TabsContent>)}
            </Tabs>
          </div>
        </aside>

        <div className="grid justify-items-center gap-8 overflow-x-auto pb-8">
          {pages.map((page, pageIndex) => (
            <div key={page.id} className="grid gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>صفحة {pageIndex + 1}</span>
                <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => addQuestion(page.id)}><Plus className="size-4" /> سؤال</Button><Button variant="ghost" size="sm" onClick={() => removePage(page.id)}><Trash2 className="size-4" /> حذف الصفحة</Button></div>
              </div>
              <div ref={(element) => { pageRefs.current[page.id] = element; }} dir="rtl" className="exam-paper" style={{ width: A4_W, height: A4_H, padding: `${marginY}px ${marginX}px` }} onClick={() => setSelectedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropBlock(page.id)}>
                {showHeader && <div className={headerLine ? "exam-header exam-header-lined" : "exam-header"} style={{ minHeight: headerSpace }}>
                  <div className="mb-2 text-center text-base font-bold">بسم الله الرحمن الرحيم</div>
                  <div className="flex items-center justify-between gap-3">
                    {headerImageRight && <img src={headerImageRight} alt="صورة يمين الرأس" className="object-contain" style={{ height: headerImageSize }} />}
                    <div className="text-sm leading-7"><div>{ministry}</div><div>{directorate}</div><div>{school}</div></div>
                    <div className="flex-1 text-center">{logo && <img src={logo} alt="شعار" className="mx-auto mb-1.5 object-contain" style={{ height: logoSize }} />}<div className="text-xl font-bold">{examTitle}</div><div className="text-sm">{subject}</div></div>
                    <div className="text-left text-sm leading-7"><div>{grade}</div><div>الزمن: {duration}</div>{dateText && <div>التاريخ: {dateText}</div>}</div>
                    {headerImageLeft && <img src={headerImageLeft} alt="صورة يسار الرأس" className="object-contain" style={{ height: headerImageSize }} />}
                  </div>
                </div>}

                <div
                  ref={(element) => { wrapRefs.current[page.id] = element; }}
                  className={freeMode ? "exam-blocks exam-blocks-free" : columns === 2 ? "exam-blocks exam-blocks-columns" : "exam-blocks"}
                  onPointerMove={freeMode ? (event) => onFreePointerMove(event, page.id) : undefined}
                  onPointerUp={freeMode ? endFreeDrag : undefined}
                  onPointerLeave={freeMode ? endFreeDrag : undefined}
                >
                  {page.blocks.map((block) => {
                    const currentQuestionNumber = block.type === "question" ? ++questionNumber : null;
                    const selected = block.id === selectedId;
                    const side = block.ca ?? "right";
                    const flowStyle = block.w
                      ? {
                          width: `${block.w}%`,
                          marginInlineStart: side === "right" ? 0 : "auto",
                          marginInlineEnd: side === "left" ? 0 : "auto",
                        }
                      : undefined;
                    const freeStyle = freeMode
                      ? { right: `${block.x ?? 4}%`, top: `${block.y ?? 0}%`, width: `${block.w ?? 92}%`, cursor: "move" as const }
                      : flowStyle;
                    return <div
                      key={block.id}
                      ref={(element) => { blockRefs.current[block.id] = element; }}
                      draggable={!freeMode}
                      style={freeStyle}
                      onPointerDown={freeMode ? (event) => onFreePointerDown(event, page.id, block) : undefined}
                      onDragStart={freeMode ? undefined : (event) => { setDragged({ pageId: page.id, blockId: block.id }); event.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragged(null); setDropTarget(null); }}
                      onDragOver={freeMode ? undefined : (event) => { event.preventDefault(); event.stopPropagation(); setDropTarget(block.id); }}
                      onDrop={freeMode ? undefined : (event) => { event.preventDefault(); event.stopPropagation(); dropBlock(page.id, block.id); }}
                      onClick={(event) => { event.stopPropagation(); setSelectedId(block.id); }}
                      className={`exam-block group ${freeMode ? "exam-block-free" : ""} ${selected ? "exam-block-selected" : ""} ${dropTarget === block.id && dragged?.blockId !== block.id ? "exam-block-drop" : ""}`}
                    >
                      <div className="exam-block-handle" aria-hidden="true"><GripVertical className="size-4" /></div>
                      {block.type === "question" ? <div className="flex items-start gap-2">
                        <span className="shrink-0 pt-0.5 font-bold">س{currentQuestionNumber}.</span>
                        <div
                          ref={(element) => {
                            editorRefs.current[block.id] = element;
                            if (element && element !== document.activeElement && element.innerHTML !== block.html) {
                              element.innerHTML = block.html;
                            }
                          }}
                          contentEditable
                          suppressContentEditableWarning
                          onPointerDown={(event) => event.stopPropagation()}
                          onFocus={() => setSelectedId(block.id)}
                          onInput={(event) => patchBlock(block.id, { html: event.currentTarget.innerHTML })}
                          className="min-w-0 flex-1 outline-none"
                          style={{ fontFamily: block.fontFamily, fontSize: block.fontSize, textAlign: block.align }}
                        />
                      </div> : <div style={{ textAlign: block.align }}><img src={block.src} alt={block.alt} className="inline-block max-h-72 object-contain" style={{ width: `${block.width}%` }} /></div>}
                    </div>;
                  })}
                  {page.blocks.length === 0 && <Button variant="outline" className="m-auto" onClick={(event) => { event.stopPropagation(); addQuestion(page.id); }}><Plus className="size-4" /> إضافة أول سؤال</Button>}
                </div>

                {showFooter && <div className={footerLine ? "exam-footer exam-footer-lined" : "exam-footer"} style={{ minHeight: footerSpace }}>{footerNote && <div className="font-bold">{footerNote}</div>}{footerText && <div>{footerText}</div>}{showPageNumber && <div className="text-muted-foreground">صفحة {pageIndex + 1} من {pages.length}</div>}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="grid gap-1.5"><Label className="text-xs">{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}
