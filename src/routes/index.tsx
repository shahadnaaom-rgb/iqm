import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Award,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  ImageDown,
  Images,
  Newspaper,
  PenTool,
  ScanLine,
  Settings,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { AdSlot } from "../components/AdSlot";
import { PrivacyNote } from "../components/PrivacyNote";
import { Button } from "../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "منصة الأستاذ — أدوات المدرس تعمل على جهازك" },
      {
        name: "description",
        content:
          "ضغط الصور، إنشاء الشهادات، وشهادات جماعية من ملف Excel — كل شيء داخل المتصفح بدون رفع أي ملف.",
      },
      { property: "og:title", content: "منصة الأستاذ" },
      {
        property: "og:description",
        content: "أدواتك التعليمية، مباشرة على جهازك: صور، شهادات، Excel، خطوط.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const TOOLS = [
  {
    to: "/tools/image-compressor",
    icon: ImageDown,
    title: "ضغط الصور",
    desc: "ضغط وتحويل الصور بدون رفعها.",
  },
  {
    to: "/tools/pdf",
    icon: FileText,
    title: "أدوات PDF",
    desc: "تحرير الصفحات وتحويل الصور ↔ PDF.",
  },
  {
    to: "/tools/collage",
    icon: Images,
    title: "تجميع الصور",
    desc: "اجمع عدة صور في قالب واحد وصدّرها بدقة عالية.",
  },
  { to: "/tools/barcode", icon: ScanLine, title: "صانع الباركود", desc: "رموز QR وباركود بخلفية شفافة أو ملونة." },
  {
    icon: GraduationCap,
    title: "إنشاء الشهادات",
    desc: "شهادة فردية، تقديرية أو درجات.",
    certificate: true,
  },
  { to: "/articles", icon: Newspaper, title: "المقالات", desc: "مقالات وإرشادات للمدرسين." },
  { to: "/tools/fonts", icon: PenTool, title: "الخطوط", desc: "أضف خطوطك الخاصة." },
  { to: "/settings", icon: Settings, title: "الإعدادات", desc: "الوضع الليلي وتنظيف البيانات." },
] as const;

const FEATURES = [
  { icon: ShieldCheck, title: "خصوصية كاملة", desc: "الملفات لا تخرج من جهازك أبداً." },
  { icon: Zap, title: "سرعة فورية", desc: "لا انتظار للرفع أو التحميل من خادم." },
  { icon: GraduationCap, title: "صُنع للمدرسين", desc: "أدوات مصممة لاحتياجاتك اليومية في المدرسة." },
];

function Home() {
  return (
    <>
      <section className="gradient-hero border-b border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-16 text-center sm:py-24">
          <PrivacyNote className="mx-auto" />
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">منصة الأستاذ</h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            أدواتك التعليمية، مباشرة على جهازك. أدوات مجانية تحافظ على خصوصية ملفاتك وبيانات طلابك.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild size="lg" className="h-11 shadow-soft">
              <Link to="/tools/pdf">ابدأ بأدوات PDF</Link>
            </Button>
            <Link
              to="/tools/image-compressor"
              className="inline-flex h-11 items-center rounded-xl border border-border bg-card px-6 font-medium transition-colors hover:bg-secondary"
            >
              ضغط الصور
            </Link>
          </div>
        </div>
      </section>

      <AdSlot placement="home" className="pt-8" />

      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-xl font-bold sm:text-2xl">الأدوات</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => {
            const content = (
              <>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <tool.icon className="size-5" />
                </span>
                <span className="grid min-w-0 gap-1">
                  <span className="font-display font-bold">{tool.title}</span>
                  <span className="text-sm text-muted-foreground">{tool.desc}</span>
                </span>
              </>
            );
            if ("certificate" in tool) return (
              <DropdownMenu key={tool.title} dir="rtl">
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="surface group flex h-auto min-h-24 w-full items-start justify-start gap-4 whitespace-normal p-5 text-right transition-all hover:-translate-y-0.5 hover:bg-card hover:shadow-lift" aria-label="إنشاء الشهادات، اختر نوع الشهادة">
                    {content}
                    <ChevronDown className="mr-auto mt-3 size-4 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem asChild><Link to="/tools/certificates"><GraduationCap /> شهادة فردية</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/tools/excel-certificates" search={{ mode: "appreciation" }}><Award /> شهادة تقديرية</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/tools/excel-certificates" search={{ mode: "grades" }}><FileSpreadsheet /> شهادة درجات</Link></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
            return (
              <Link key={tool.title} to={tool.to} className="surface group flex min-h-24 items-start gap-4 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift">
                {content}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <div className="surface grid gap-6 p-6 sm:grid-cols-3 sm:p-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="grid gap-2">
              <f.icon className="size-6 text-accent" />
              <h3 className="font-display font-bold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
