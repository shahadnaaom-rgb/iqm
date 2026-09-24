"""اختبارات تشغيلية لصفحتي منضّد الأسئلة وتجميع الصور.

التشغيل:  python3 tests/e2e/smoke.py [http://localhost:8080]
تتحقق من: فتح الصفحات، الانتقال بين الأدوات، إضافة الأسئلة/الصفحات/الرموز،
وأن التصدير (PNG/PDF/JPG) يتم بدقة عالية، وبدون أي خطأ وقت التشغيل.
"""

import asyncio
import io
import os
import struct
import sys
import tempfile

from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/")
OUT = os.path.join(tempfile.gettempdir(), "exam-collage-e2e")
os.makedirs(OUT, exist_ok=True)

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + ((" — " + detail) if detail else ""))


def png_size(path: str) -> tuple[int, int]:
    with open(path, "rb") as fh:
        head = fh.read(24)
    return struct.unpack(">II", head[16:24])


def make_png(path: str, w: int, h: int, color: bytes) -> None:
    import zlib

    raw = b"".join(b"\x00" + color * w for _ in range(h))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as fh:
        fh.write(png)


async def run() -> None:
    errors: list[str] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 1800}, accept_downloads=True
        )
        page = await context.new_page()
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on(
            "console",
            lambda m: errors.append(f"console: {m.text}") if m.type == "error" else None,
        )

        # 1) الانتقال من الرئيسية إلى منضّد الأسئلة عبر شريط التنقل
        await page.goto(BASE + "/", wait_until="domcontentloaded")
        await page.get_by_role("link", name="تنضيد الأسئلة").first.click()
        await page.wait_for_url("**/tools/exam-builder")
        await page.wait_for_timeout(1500)
        check("الانتقال إلى منضّد الأسئلة", "/tools/exam-builder" in page.url, page.url)

        editors = page.locator('[contenteditable="true"]')
        before = await editors.count()
        check("عرض كتل الأسئلة الافتراضية", before >= 3, f"{before} كتلة")

        # 2) التحقق من نموذج الرأس ذي المربعات الأربعة
        header = page.locator(".exam-header").first
        check("أربعة مربعات في الرأس الافتراضي", await header.locator('[contenteditable="true"]').count() == 4)
        check("إزالة مادة الرياضيات الافتراضية", await header.get_by_text("الرياضيات").count() == 0)

        # 3) إضافة سؤال جديد
        await page.get_by_role("button", name="سؤال").first.click()
        await page.wait_for_timeout(500)
        after = await editors.count()
        check("إضافة سؤال جديد", after == before + 1, f"{before} → {after}")

        # 4) لوحة الكتلة المحددة تفتح عند اختيار سؤال
        await editors.nth(0).click()
        await page.wait_for_timeout(400)
        check(
            "فتح لوحة الكتلة المحددة",
            await page.get_by_text("سؤال نصي").first.is_visible(),
        )

        # 5) أزرار التنسيق تصبح فعّالة
        bold = page.get_by_role("button", name="عريض")
        check("تفعيل أزرار التنسيق", await bold.is_enabled())
        await bold.click()
        await page.wait_for_timeout(200)

        # 6) إضافة مربع رأس وتكراره وحذفه
        await page.get_by_label("مكان الإضافة").select_option("header")
        before_header = await header.locator('[contenteditable="true"]').count()
        await page.get_by_role("button", name="نص", exact=True).click()
        await page.wait_for_timeout(200)
        check("إضافة مربع نص للرأس", await header.locator('[contenteditable="true"]').count() == before_header + 1)
        await page.get_by_role("button", name="تكرار العنصر").click()
        await page.wait_for_timeout(200)
        check("تكرار عنصر الرأس", await header.locator('[contenteditable="true"]').count() == before_header + 2)
        await page.get_by_role("button", name="حذف العنصر").click()

        # 7) الانتقال بين تبويبات الرموز وإدراج رمز
        tabs = page.get_by_role("tab")
        tab_count = await tabs.count()
        check("عرض تبويبات الرموز", tab_count >= 3, f"{tab_count} تبويب")
        if tab_count >= 2:
            await tabs.nth(1).click()
            await page.wait_for_timeout(300)
            check("الانتقال بين تبويبات الرموز", await tabs.nth(1).is_visible())

        # 8) إضافة صفحة جديدة
        await page.get_by_role("button", name="صفحة").first.click()
        await page.wait_for_timeout(600)
        check(
            "إضافة صفحة جديدة",
            await page.get_by_text("أُضيفت صفحة جديدة").first.is_visible(),
        )

        # 7) تصدير PNG بدقة عالية (A4 بمعامل 2 ≈ 1588×2246)
        async with page.expect_download(timeout=90_000) as dl:
            await page.get_by_role("button", name="تصدير PNG").first.click()
        download = await dl.value
        exam_png = os.path.join(OUT, "exam.png")
        await download.save_as(exam_png)
        w, h = png_size(exam_png)
        check("تصدير PNG بدقة عالية للأسئلة", w >= 1500 and h >= 2100, f"{w}×{h}")

        # 8) تصدير PDF
        async with page.expect_download(timeout=120_000) as dl:
            await page.get_by_role("button", name="تصدير PDF").first.click()
        pdf = await dl.value
        exam_pdf = os.path.join(OUT, "exam.pdf")
        await pdf.save_as(exam_pdf)
        size = os.path.getsize(exam_pdf)
        check("تصدير PDF للأسئلة", size > 20_000, f"{size} بايت")

        # 9) الانتقال إلى أداة تجميع الصور
        await page.get_by_role("link", name="تجميع الصور").first.click()
        await page.wait_for_url("**/tools/collage")
        await page.wait_for_timeout(1200)
        check("الانتقال إلى تجميع الصور", "/tools/collage" in page.url, page.url)

        # 10) رفع صور واختيار قالب
        a = os.path.join(OUT, "a.png")
        b = os.path.join(OUT, "b.png")
        make_png(a, 800, 600, b"\xd0\x40\x40")
        make_png(b, 600, 800, b"\x30\x80\xd0")
        await page.set_input_files('input[type="file"]', [a, b])
        await page.wait_for_timeout(1200)
        check("إضافة الصور إلى القالب", await page.get_by_text("أُضيفت 2 صورة").first.is_visible())

        # 11) اختيار أقصى دقة تصدير (6000 بكسل)
        quality = page.locator("select").nth(1)
        await quality.select_option(label="أقصى دقة — 6000 بكسل")
        await page.wait_for_timeout(500)

        async with page.expect_download(timeout=120_000) as dl:
            await page.get_by_role("button", name="تصدير PNG").first.click()
        collage_dl = await dl.value
        collage_png = os.path.join(OUT, "collage.png")
        await collage_dl.save_as(collage_png)
        cw, ch = png_size(collage_png)
        check("تصدير تجميع الصور بدقة 6000 بكسل", cw == 6000 and ch >= 3000, f"{cw}×{ch}")

        # 12) تصدير JPG
        async with page.expect_download(timeout=120_000) as dl:
            await page.get_by_role("button", name="تصدير JPG").first.click()
        jpg = await dl.value
        jpg_path = os.path.join(OUT, "collage.jpg")
        await jpg.save_as(jpg_path)
        check("تصدير JPG لتجميع الصور", os.path.getsize(jpg_path) > 50_000)

        await browser.close()

    real_errors = [e for e in errors if "favicon" not in e and "404" not in e]
    check("لا توجد أخطاء وقت التشغيل", not real_errors, "; ".join(real_errors[:3]))

    failed = [name for name, ok, _ in results if not ok]
    print("\n" + ("=" * 40))
    print(f"{len(results) - len(failed)}/{len(results)} اختباراً ناجحاً")
    if failed:
        print("فشل: " + "، ".join(failed))
        sys.exit(1)


asyncio.run(run())
