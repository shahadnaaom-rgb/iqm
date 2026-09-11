import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Lock, Trash2, Upload } from "lucide-react";

import { Button } from "../components/ui/button";
import { adImageSrc } from "../components/AdSlot";
import {
  createAd,
  deleteAd,
  listAllAds,
  updateAd,
  verifyAdminCode,
  type Ad,
} from "../lib/ads.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — منصة الأستاذ" },
      { name: "description", content: "إدارة المساحات الإعلانية في منصة الأستاذ." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "لوحة التحكم — منصة الأستاذ" },
      { property: "og:description", content: "إدارة صور المساحات الإعلانية." },
    ],
  }),
  component: AdminPage,
});

const STORAGE_KEY = "ustath-admin-code";

function AdminPage() {
  const verify = useServerFn(verifyAdminCode);
  const fetchAll = useServerFn(listAllAds);
  const create = useServerFn(createAd);
  const update = useServerFn(updateAd);
  const remove = useServerFn(deleteAd);

  const [code, setCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [busy, setBusy] = useState(false);
  const [placement, setPlacement] = useState<"home" | "tools">("home");
  const [linkUrl, setLinkUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load(activeCode: string) {
    const rows = await fetchAll({ data: { code: activeCode } });
    setAds(rows as Ad[]);
  }

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    verify({ data: { code: saved } })
      .then(async () => {
        setCode(saved);
        setAuthed(true);
        await load(saved);
      })
      .catch(() => sessionStorage.removeItem(STORAGE_KEY));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await verify({ data: { code } });
      sessionStorage.setItem(STORAGE_KEY, code);
      setAuthed(true);
      await load(code);
    } catch {
      toast.error("رمز الدخول غير صحيح");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("اختر صورة أولاً");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة أكبر من 5 ميغابايت");
      return;
    }
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
      await create({
        data: {
          code,
          fileBase64: btoa(binary),
          contentType: file.type || "image/jpeg",
          linkUrl,
          placement,
          sortOrder: ads.length,
        },
      });
      setLinkUrl("");
      if (fileRef.current) fileRef.current.value = "";
      await load(code);
      toast.success("تمت إضافة الإعلان");
    } catch {
      toast.error("تعذّر رفع الصورة");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, patchData: Partial<Ad>) {
    try {
      await update({
        data: {
          code,
          id,
          ...(patchData.link_url !== undefined ? { linkUrl: patchData.link_url } : {}),
          ...(patchData.placement !== undefined ? { placement: patchData.placement } : {}),
          ...(patchData.is_active !== undefined ? { isActive: patchData.is_active } : {}),
          ...(patchData.sort_order !== undefined ? { sortOrder: patchData.sort_order } : {}),
        },
      });
      await load(code);
    } catch {
      toast.error("تعذّر الحفظ");
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-20">
        <form onSubmit={handleLogin} className="surface grid gap-4 p-6">
          <div className="flex items-center gap-2">
            <Lock className="size-5 text-primary" />
            <h1 className="font-display text-lg font-bold">لوحة التحكم</h1>
          </div>
          <p className="text-sm text-muted-foreground">أدخل رمز الدخول الخاص بك.</p>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="رمز الدخول"
            className="h-11 rounded-xl border border-border bg-background px-3"
          />
          <Button type="submit" disabled={busy || !code}>
            دخول
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-10">
      <h1 className="font-display text-2xl font-bold">المساحات الإعلانية</h1>

      <section className="surface grid gap-4 p-6">
        <h2 className="font-display font-bold">إضافة صورة</h2>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="rounded-xl border border-border bg-background p-2 text-sm"
        />
        <label className="grid gap-1 text-sm">
          رابط عند الضغط (اختياري)
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://"
            dir="ltr"
            className="h-11 rounded-xl border border-border bg-background px-3"
          />
        </label>
        <label className="grid gap-1 text-sm">
          مكان الظهور
          <select
            value={placement}
            onChange={(e) => setPlacement(e.target.value as "home" | "tools")}
            className="h-11 rounded-xl border border-border bg-background px-3"
          >
            <option value="home">الصفحة الرئيسية</option>
            <option value="tools">صفحات الأدوات</option>
          </select>
        </label>
        <Button onClick={handleUpload} disabled={busy}>
          <Upload className="size-4" />
          رفع الإعلان
        </Button>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display font-bold">الإعلانات الحالية ({ads.length})</h2>
        {ads.length === 0 && <p className="text-sm text-muted-foreground">لا توجد إعلانات بعد.</p>}
        {ads.map((ad) => (
          <div key={ad.id} className="surface grid gap-3 p-4 sm:grid-cols-[160px_1fr]">
            <img
              src={adImageSrc(ad.image_url)}
              alt="إعلان"
              className="h-24 w-full rounded-lg object-cover"
            />
            <div className="grid gap-2">
              <input
                defaultValue={ad.link_url ?? ""}
                onBlur={(e) => patch(ad.id, { link_url: e.target.value })}
                placeholder="رابط الإعلان"
                dir="ltr"
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={ad.placement}
                  onChange={(e) => patch(ad.id, { placement: e.target.value })}
                  className="h-10 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  <option value="home">الرئيسية</option>
                  <option value="tools">الأدوات</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => patch(ad.id, { is_active: !ad.is_active })}
                >
                  {ad.is_active ? "إيقاف" : "تفعيل"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await remove({ data: { code, id: ad.id } });
                    await load(code);
                  }}
                >
                  <Trash2 className="size-4" />
                  حذف
                </Button>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
