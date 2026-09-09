import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";

import { PageHeader } from "../components/PrivacyNote";
import updates from "../data/updates.json";

export const Route = createFileRoute("/updates")({
  head: () => ({
    meta: [
      { title: "التحديثات وآخر الإضافات — منصة الأستاذ" },
      {
        name: "description",
        content: "تابع آخر إضافات منصة الأستاذ: أدوات جديدة وتحسينات على الشهادات وضغط الصور.",
      },
      { property: "og:title", content: "التحديثات — منصة الأستاذ" },
      { property: "og:description", content: "آخر إضافات وتحسينات المنصة." },
    ],
  }),
  component: Updates,
});

function Updates() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-10">
      <PageHeader
        icon={<Megaphone className="size-6" />}
        title="التحديثات"
        description="كل جديد في منصة الأستاذ."
      />
      <ol className="grid gap-4">
        {updates.map((item) => (
          <li key={item.title} className="surface grid gap-2 p-5">
            <time className="text-xs text-muted-foreground">{item.date}</time>
            <h2 className="font-display text-lg font-bold">{item.title}</h2>
            <p className="text-sm text-muted-foreground">{item.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
