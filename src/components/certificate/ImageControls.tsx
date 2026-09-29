import { Trash2 } from "lucide-react";

import type { CertificateImage } from "../../lib/certificate";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";

type Props = {
  item: CertificateImage;
  onChange: (patch: Partial<CertificateImage>) => void;
  onRemove: () => void;
};

export function ImageControls({ item, onChange, onRemove }: Props) {
  return (
    <div className="grid gap-5">
      <p className="truncate text-sm font-medium">{item.name}</p>
      <div className="grid gap-2">
        <Label>عرض الصورة: {Math.round(item.width * 100)}%</Label>
        <Slider value={[item.width * 100]} min={5} max={100} step={1} onValueChange={([value]) => onChange({ width: (value ?? 25) / 100 })} />
      </div>
      <div className="grid gap-2">
        <Label>تدوير الصورة: {item.rotation}°</Label>
        <Slider value={[item.rotation]} min={-180} max={180} step={1} onValueChange={([value]) => onChange({ rotation: value ?? 0 })} />
      </div>
      <div className="grid gap-2">
        <Label>محاذاة الصورة على الشهادة</Label>
        <div className="grid grid-cols-3 gap-1">
          <Button size="sm" variant="outline" onClick={() => onChange({ x: 1 - item.width / 2 })}>يمين</Button>
          <Button size="sm" variant="outline" onClick={() => onChange({ x: 0.5 })}>وسط</Button>
          <Button size="sm" variant="outline" onClick={() => onChange({ x: item.width / 2 })}>يسار</Button>
          <Button size="sm" variant="outline" onClick={() => onChange({ y: 0.08 })}>أعلى</Button>
          <Button size="sm" variant="outline" onClick={() => onChange({ y: 0.5 })}>منتصف</Button>
          <Button size="sm" variant="outline" onClick={() => onChange({ y: 0.92 })}>أسفل</Button>
        </div>
      </div>
      <Button size="sm" variant="outline" className="w-fit text-destructive" onClick={onRemove}>
        <Trash2 className="size-4" /> حذف الصورة
      </Button>
    </div>
  );
}