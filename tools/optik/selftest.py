"""Kendi kendini sınar: rastgele doldurulmuş formları fotoğraf/tarama gibi bozar (eğim, perspektif, gölge, gürültü, JPEG, baş aşağı)
ve okuyucunun doğruluğunu ölçer. Kullanım: python selftest.py [--n 30] [--questions 90] [--hard]"""
import argparse, random, sys
import cv2
import numpy as np
from PIL import Image, ImageDraw
import layout as L
import make_sheet
import read


def fill_sheet(im, nq, rng, pencil=False):
    d = ImageDraw.Draw(im)
    truth, num = [], "".join(str(rng.randrange(10)) for _ in range(L.NUM_DIGITS))
    shade = lambda: rng.randint(110, 150) if pencil else rng.randint(10, 60)

    def dot(x, y):
        j = rng.randint(-2, 2), rng.randint(-2, 2)
        r = L.R - rng.randint(2, 4)
        d.ellipse([x + j[0] - r, y + j[1] - r, x + j[0] + r, y + j[1] + r], fill=shade())
    for dg in range(L.NUM_DIGITS):
        x, y = L.num_pos(dg)[int(num[dg])]; dot(x, y)
    for i in range(nq):
        t = rng.random()
        if t < 0.08:
            truth.append("-")
        elif t < 0.12:
            a, b = rng.sample(range(5), 2)
            for k in (a, b):
                dot(*L.q_pos(i)[k])
            truth.append("*")
        else:
            k = rng.randrange(5); dot(*L.q_pos(i)[k]); truth.append(L.CHOICES[k])
    return num, "".join(truth)


def distort(im, rng, hard):
    a = np.array(im.convert("L"))
    big = cv2.resize(a, None, fx=1.4, fy=1.4, interpolation=cv2.INTER_CUBIC)
    h, w = big.shape
    pad = 180
    canvas = np.full((h + 2 * pad, w + 2 * pad), 90, np.uint8)       # koyu masa
    canvas[pad:pad + h, pad:pad + w] = big
    H, W = canvas.shape
    j = (60 if hard else 30)
    src = np.float32([[pad, pad], [pad + w, pad], [pad, pad + h], [pad + w, pad + h]])
    dst = src + np.float32([[rng.randint(-j, j), rng.randint(-j, j)] for _ in range(4)])
    ang = rng.uniform(-5, 5) * (1.6 if hard else 1)
    M = cv2.getRotationMatrix2D((W / 2, H / 2), ang, 1.0)
    P = cv2.getPerspectiveTransform(src, dst)
    out = cv2.warpPerspective(canvas, P, (W, H), borderValue=90)
    out = cv2.warpAffine(out, M, (W, H), borderValue=90)
    xs = np.linspace(0.65 if hard else 0.8, 1.05, W)[None, :]       # soldan sağa ışık gradyanı (gölge)
    out = np.clip(out * xs, 0, 255).astype(np.uint8)
    out = cv2.GaussianBlur(out, (0, 0), rng.uniform(0.6, 1.4 if hard else 1.0))
    out = np.clip(out.astype(np.int16) + np.random.default_rng(rng.randrange(10**6)).normal(0, 6 if hard else 3, out.shape), 0, 255).astype(np.uint8)
    if rng.random() < 0.5:
        out = cv2.rotate(out, cv2.ROTATE_180)                         # baş aşağı tarama
    ok, enc = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, rng.randint(55, 85)])
    return cv2.imdecode(enc, cv2.IMREAD_COLOR)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--questions", type=int, default=90)
    ap.add_argument("--hard", action="store_true", help="daha sert bozulma + kurşun kalem gri tonu")
    a = ap.parse_args()
    rng = random.Random(7)
    blank = make_sheet.make(a.questions, "Sınama")
    tot_q = wrong_q = fail = bad_no = flagged_wrong = 0
    for n in range(a.n):
        im = blank.copy()
        num, truth = fill_sheet(im, a.questions, rng, pencil=a.hard)
        try:
            res, _, _ = read.read_sheet(distort(im, rng, a.hard), a.questions)
        except read.SheetError as e:
            fail += 1; print(f"#{n}: OKUNAMADI: {e}"); continue
        errs = [i for i, (x, y) in enumerate(zip(res["answers"], truth)) if x != y]
        bad_no += res["student_no"] != num
        tot_q += a.questions; wrong_q += len(errs)
        warned = {int(w.split()[1].rstrip(":")) - 1 for w in res["warnings"] if w.startswith("soru")}
        flagged_wrong += sum(1 for i in errs if i in warned)
        if errs or res["student_no"] != num:
            print(f"#{n}: hatalı soru {[i + 1 for i in errs][:8]} no {'OK' if res['student_no'] == num else res['student_no'] + '≠' + num}")
    ok = a.n - fail
    print(f"\nForm: {a.n} (okunamayan {fail}) · Soru doğruluğu: {100 * (1 - wrong_q / max(tot_q, 1)):.2f}% ({wrong_q}/{tot_q} hatalı) · öğrenci no hatası {bad_no}/{ok}")
    sys.exit(1 if fail or wrong_q / max(tot_q, 1) > 0.005 or bad_no else 0)


if __name__ == "__main__":
    main()
