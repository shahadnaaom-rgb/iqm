import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, GraduationCap, ImagePlus, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "../../components/PrivacyNote";
import { UploadZone } from "../../components/UploadZone";
import { FieldControls } from "../../components/certificate/FieldControls";
import { ImageControls } from "../../components/certificate/ImageControls";
import { TemplateCanvas } from "../../components/certificate/TemplateCanvas";
import { useFontFamilies } from "../../components/certificate/useFontFamilies";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import {
  canvasToBlob,
  autoNumberCount,
  drawCertificate,
  fieldValue,
  loadImageFromFile,
  newField,
  safeFileName,
  uid,
  type CertificateImage,
  type Field,
} from "../../lib/certificate";
import { DEFAULT_SCALE, scaleOf, type ExportScaleId } from "../../lib/export";
import { ExportQuality } from "../../components/ExportQuality";
import { downloadBlob } from "../../lib/save";

export const Route = createFileRoute("/tools/certificates")({
  head: () => ({
    meta: [
      { title: "إنشاء شهادة لطالب واحد — منصة الأستاذ" },
      {
        name: "description",
        content: "ارفع قالب الشهادة، أضف اسم الطالب وحرّكه بالماوس، اختر الخط ثم احفظ PNG أو JPG.",
      },
      { property: "og:title", content: "إنشاء الشهادات — منصة الأستاذ" },
      { property: "og:description", content: "محرر شهادات يعمل داخل متصفحك مع دعم كامل للعربية." },
       { property: "og:type", content: "website" },
       { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SingleCertificate,
});

function SingleCertificate() {
  const { families } = useFontFamilies();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fields, setFields] = useState<Field[]>([newField()]);
  const [images, setImages] = useState<CertificateImage[]>([]);
  const imageInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [quality, setQuality] = useState<ExportScaleId>(DEFAULT_SCALE);
  const hasNumber = fields.some((f) => f.autoNumber);

  const selectedField = fields.find((f) => f.id === selected) ?? (selected === null ? fields[0] : undefined);
  const selectedImage = images.find((item) => item.id === selected);

  const patch = (id: string, p: Partial<Field>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const move = (id: string, x: number, y: number) => {
    patch(id, { x, y });
    setImages((prev) => prev.map((item) => item.id === id ? { ...item, x, y } : item));
  };
  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const additions = await Promise.all(Array.from(files).filter((file) => file.type.startsWith("image/")).map(async (file) => ({
      id: uid(), image: await loadImageFromFile(file), name: file.name, x: 0.5, y: 0.5, width: 0.2, rotation: 0,
    })));
    setImages((prev) => [...prev, ...additions]);
    if (additions[0]) setSelected(additions[0].id);
  };

  const onTemplate = async (files: File[]) => {
    try {
      const img = await loadImageFromFile(files[0]!);
      setImage(img);
      toast.success("تم تحميل القالب على جهازك");
    } catch {
      toast.error("تعذر قراءة صورة القالب");
    }
  };

  const save = async (type: "image/png" | "image/jpeg") => {
    if (!image) return;
    const canvas = document.createElement("canvas");
    const numField = fields.find((f) => f.autoNumber);
    const total = hasNumber ? autoNumberCount(numField) : 1;
    for (let i = 0; i < total; i++) {
      const row = { __index: String(i) };
      drawCertificate(canvas, image, fields, row, scaleOf(quality), images);
      const blob = await canvasToBlob(canvas, type);
      const base = numField ? fieldValue(numField, row) : fields[0] ? fieldValue(fields[0]) : "شهادة";
      downloadBlob(blob, `${safeFileName(base)}.${type === "image/png" ? "png" : "jpg"}`);
      if (total > 1) await new Promise((r) => setTimeout(r, 150));
    }
    toast.success(total > 1 ? `تم حفظ ${total} نسخة مرقّمة` : "تم حفظ الشهادة", { duration: 10000, action: { label: "اذهب للتجميع", onClick: () => { window.location.href = "/tools/collage"; } } });
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10">
      <PageHeader
        icon={<GraduationCap className="size-6" />}
        title="إنشاء شهادة"
        description="ارفع قالب الشهادة، أضف الحقول وحرّكها بالماوس أو اللمس فوق الصورة، ثم احفظ الصورة."
      />

      {!image ? (
        <UploadZone
          accept="image/*"
          title="ارفع صورة القالب (certificate.png)"
          hint="PNG · JPG · WebP"
          onFiles={onTemplate}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="grid gap-3">
            <TemplateCanvas
              image={image}
              fields={fields}
              images={images}
              selectedId={selectedImage?.id ?? selectedField?.id}
              onSelect={setSelected}
              onMove={move}
            />
            <ExportQuality value={quality} onChange={setQuality} className="max-w-xs" />
            {hasNumber && <p className="text-sm font-medium text-primary">سيتم حفظ {autoNumberCount(fields.find((f) => f.autoNumber))} نسخة حسب المدى المحدد.</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save("image/png")}>
                <Download className="size-4" /> حفظ PNG
              </Button>
              <Button variant="outline" onClick={() => save("image/jpeg")}>
                <Download className="size-4" /> حفظ JPG
              </Button>
              <Button variant="ghost" onClick={() => setImage(null)}>
                تغيير القالب
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/tools/excel-certificates">شهادات جماعية من Excel</Link>
              </Button>
            </div>
          </div>

          <div className="surface grid h-fit gap-5 p-5">
            <div className="grid gap-2">
              <Label>الحقول</Label>
              <div className="flex flex-wrap gap-2">
                {fields.map((f) => (
                  <Button
                    key={f.id}
                    size="sm"
                    variant={selectedField?.id === f.id ? "default" : "outline"}
                    onClick={() => setSelected(f.id)}
                  >
                    {f.key}
                  </Button>
                ))}
                {images.map((item) => (
                  <Button key={item.id} size="sm" variant={selectedImage?.id === item.id ? "default" : "outline"} onClick={() => setSelected(item.id)}>
                    <ImagePlus className="size-4" /> {item.name}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const f = newField({ key: "حقل جديد", text: "نص", y: 0.62, fontSize: 0.05 });
                    setFields((prev) => [...prev, f]);
                    setSelected(f.id);
                  }}
                >
                  <Plus className="size-4" /> إضافة حقل
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const f = newField({ key: "الرقم", text: "1", x: 0.85, y: 0.1, fontSize: 0.04, bold: false, autoNumber: { start: 1, end: 10, pad: 1, prefix: "" } });
                    setFields((prev) => [...prev, f]);
                    setSelected(f.id);
                  }}
                >
                  <Plus className="size-4" /> ترقيم تلقائي
                </Button>
                <Button size="sm" variant="secondary" onClick={() => imageInput.current?.click()}>
                  <ImagePlus className="size-4" /> إضافة صورة
                </Button>
                <input ref={imageInput} type="file" accept="image/*" multiple className="hidden" aria-label="اختيار صور للشهادة" onChange={(event) => { void addImages(event.target.files).catch(() => toast.error("تعذر قراءة الصورة")); event.target.value = ""; }} />
              </div>
            </div>

            {selectedImage ? (
              <ImageControls item={selectedImage} onChange={(patch) => setImages((prev) => prev.map((item) => item.id === selectedImage.id ? { ...item, ...patch } : item))} onRemove={() => { setImages((prev) => prev.filter((item) => item.id !== selectedImage.id)); setSelected(null); }} />
            ) : selectedField && (
              <FieldControls
                field={selectedField}
                families={families}
                onChange={(p) => patch(selectedField.id, p)}
                onRemove={() => {
                  setFields((prev) => prev.filter((f) => f.id !== selectedField.id));
                  setSelected(null);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
