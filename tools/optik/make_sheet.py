"""Boş optik form üretir (PNG ve PDF). Kullanım: python make_sheet.py --questions 40 --title "TYT Deneme 1" --out out/form"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont
import layout as L


def font(size, bold=False):
    for p in (r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def make(questions, title="Optik Form", exam=""):
    if not 1 <= questions <= L.MAX_Q:
        raise ValueError(f"Soru sayısı 1-{L.MAX_Q} olmalı")
    im = Image.new("L", (L.W, L.H), 255)
    d = ImageDraw.Draw(im)
    for cx, cy in L.MARK_C:
        d.rectangle([cx - L.MARK // 2, cy - L.MARK // 2, cx + L.MARK // 2, cy + L.MARK // 2], fill=0)
    d.text((140, 110), title, font=font(40, True), fill=0)
    if exam:
        d.text((140, 165), exam, font=font(24), fill=60)
    d.text((140, 215), "Ad Soyad: ______________________________   Sınıf: ________", font=font(26), fill=0)
    d.text((620, 330), "Nasıl işaretlenir?  Baloncuğu koyu kalemle tamamen doldur.", font=font(22), fill=0)
    d.text((620, 365), "Yanlış işaretlediysen silgiyle iyice sil. Tek soruya tek işaret.", font=font(22), fill=0)
    d.ellipse([640, 420, 640 + 2 * L.R, 420 + 2 * L.R], fill=0)
    d.text((675, 420), "doğru", font=font(20), fill=0)
    d.ellipse([760, 420, 760 + 2 * L.R, 420 + 2 * L.R], outline=0, width=2)
    d.line([765, 425, 760 + 2 * L.R - 5, 420 + 2 * L.R - 5], fill=0, width=2)
    d.text((795, 420), "yanlış", font=font(20), fill=0)
    # öğrenci numarası
    d.text((140, 322), "Öğrenci No", font=font(22, True), fill=0)
    for dig in range(L.NUM_DIGITS):
        for k, (x, y) in enumerate(L.num_pos(dig)):
            d.ellipse([x - L.R, y - L.R, x + L.R, y + L.R], outline=0, width=2)
    for k in range(10):
        d.text((L.NUM_X0 - 44, L.NUM_Y0 + k * L.NUM_DY - 9), str(k), font=font(16, True), fill=0)
    # cevaplar
    for c in range(min(L.COLS, -(-questions // L.ROWS_PER_COL))):
        for k in range(len(L.CHOICES)):
            d.text((L.COL_X0[c] + 44 + k * L.CH_DX - 6, L.ANS_Y0 - 44), L.CHOICES[k], font=font(17, True), fill=0)
    for i in range(questions):
        lx, ly = L.q_label_pos(i)
        d.text((lx, ly - 9), f"{i + 1}", font=font(17, True), fill=0)
        for k, (x, y) in enumerate(L.q_pos(i)):
            d.ellipse([x - L.R, y - L.R, x + L.R, y + L.R], outline=0, width=2)
    return im


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--questions", type=int, default=40)
    ap.add_argument("--title", default="Optik Form")
    ap.add_argument("--exam", default="")
    ap.add_argument("--out", default="out/form")
    a = ap.parse_args()
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    im = make(a.questions, a.title, a.exam)
    im.save(a.out + ".png", dpi=(150, 150))
    im.convert("RGB").save(a.out + ".pdf", resolution=150)
    print(f"Yazıldı: {a.out}.png ve {a.out}.pdf (A4, {a.questions} soru). Yazıcıdan %100 ölçekle (sığdırma YOK) bas.")
