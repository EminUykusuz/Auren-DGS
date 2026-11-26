"""Optik okuyucu. Kullanım:
  python read.py tarama.jpg --questions 40 --key ABCDEABCDE... --out out/sonuc
  python read.py klasor/ --questions 90 --key-file cevap.txt --wrong-div 4 --debug out/debug
Girdi: JPG/PNG/PDF (PDF'te her sayfa bir form). Çıktı: <out>.csv (Excel'de açılır) ve <out>.json.
Hata azaltma: köşe işaretleriyle perspektif düzeltme, 4 yönde otomatik yön bulma, ışık dengeleme, belirsiz satırlar için uyarı."""
import argparse, csv, glob, json, os, sys
import cv2
import numpy as np
import layout as L

REF = np.float32(L.MARK_C)


class SheetError(Exception):
    pass


def imread(path):
    data = np.fromfile(path, dtype=np.uint8)           # Türkçe/Unicode yollar için
    im = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if im is None:
        raise SheetError("Görüntü açılamadı")
    return im


def load_pages(path):
    if path.lower().endswith(".pdf"):
        import pymupdf
        doc = pymupdf.open(path)
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=200)
            arr = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, pix.n)
            yield f"{os.path.basename(path)}#s{i + 1}", cv2.cvtColor(arr, cv2.COLOR_RGBA2BGR if pix.n == 4 else cv2.COLOR_RGB2BGR)
    else:
        yield os.path.basename(path), imread(path)


def find_markers(gray):
    """Dört köşe işaretinin merkezlerini (sol-üst, sağ-üst, sol-alt, sağ-alt) döndürür."""
    h, w = gray.shape
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    # Birkaç eşikleme dener (genel Otsu, sonra gölgeye dayanıklı yerel eşik); ilk tutarlı dörtlüyü alır
    bws = [cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]]
    for blk, c in ((151, 18), (101, 12), (201, 25)):
        bws.append(cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, blk, c))
    bg = cv2.GaussianBlur(gray, (0, 0), 40)
    nrm = cv2.divide(gray, np.maximum(bg, 1), scale=255)
    bws.append(cv2.threshold(cv2.GaussianBlur(nrm, (5, 5), 0), 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1])
    last = None
    for bw in bws:
        try:
            return _markers_from(bw, h, w)
        except SheetError as e:
            last = e
    raise last


def _markers_from(bw, h, w):
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    cnts, _ = cv2.findContours(bw, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cand = []
    for c in cnts:
        a = cv2.contourArea(c)
        if not (h * w * 8e-5 < a < h * w * 0.02):
            continue
        x, y, bw_, bh = cv2.boundingRect(c)
        if not (0.65 < bw_ / bh < 1.5) or a / (bw_ * bh) < 0.65:
            continue
        m_ = np.zeros((bh, bw_), np.uint8)                   # işaret DOLU karedir; baloncuk halkasının içi boştur
        cv2.drawContours(m_, [c - [x, y]], -1, 255, -1)
        if (bw[y:y + bh, x:x + bw_][m_ > 0] > 0).mean() < 0.85:
            continue
        peri = cv2.arcLength(c, True)
        if len(cv2.approxPolyDP(c, 0.06 * peri, True)) != 4:
            continue
        m = cv2.moments(c)
        cand.append((m["m10"] / m["m00"], m["m01"] / m["m00"], a))
    if len(cand) < 4:
        raise SheetError(f"Köşe işaretleri bulunamadı ({len(cand)}/4). Formun dört köşesi de görüntüde, net ve kesilmemiş olmalı")
    pts = np.array(cand)
    best = None
    for ref in pts:                                          # boyutu benzer adaylar bir grup; fazladan koyu lekeler elenir
        grp = pts[(pts[:, 2] > ref[2] * 0.6) & (pts[:, 2] < ref[2] * 1.6)]
        if len(grp) < 4:
            continue
        s_, d_ = grp[:, 0] + grp[:, 1], grp[:, 0] - grp[:, 1]
        quad = np.array([grp[np.argmin(s_)], grp[np.argmax(d_)], grp[np.argmin(d_)], grp[np.argmax(s_)]])   # TL, TR, BL, BR
        if len({(round(q[0]), round(q[1])) for q in quad}) < 4:
            continue
        xy = quad[:, :2]
        area = cv2.contourArea(xy[[0, 1, 3, 2]].astype(np.float32))
        side = [np.linalg.norm(xy[i] - xy[j]) for i, j in ((0, 1), (2, 3), (0, 2), (1, 3))]
        ratio = max(side[2], side[3]) / max(min(side[0], side[1]), 1)
        if area > h * w * 0.12 and 1.0 < ratio < 2.2 and (best is None or area > best[0]):
            best = (area, quad)
    if best is None:
        raise SheetError("Köşe işaretleri tutarsız (kağıt eğri, buruşuk ya da fazladan koyu kare var)")
    quad = best[1]
    return np.float32([[q[0], q[1]] for q in quad])


def _disc_mask(r):
    m = np.zeros((2 * r + 1, 2 * r + 1), np.uint8)
    cv2.circle(m, (r, r), r, 1, -1)
    return m.astype(bool)


def _patches(img, centers, r):
    out = []
    for x, y in centers:
        x, y = int(round(x)), int(round(y))
        out.append(img[y - r:y + r + 1, x - r:x + r + 1])
    return out


def _all_ring_points(nq):
    pts = []
    for i in range(nq):
        pts += L.q_pos(i)
    return pts


def ring_score(gray_warp, nq):
    """Baloncuk halkalarının yerinde ne kadar koyuluk var? Doğru yönde yüksek, yanlış yönde ~0."""
    ys, xs = np.mgrid[-L.R - 2:L.R + 3, -L.R - 2:L.R + 3]
    rr = np.hypot(xs, ys)
    ring = (rr >= L.R - 1.5) & (rr <= L.R + 1.5)
    tot, n = 0.0, 0
    for p in _patches(gray_warp, _all_ring_points(nq), L.R + 2):
        if p.shape != ring.shape:
            continue
        tot += 255 - p[ring].mean()
        n += 1
    return tot / max(n, 1)


def warp_best(gray, corners, nq):
    best = None
    for rot in range(4):                                  # kağıt baş aşağı/yan taranmış olabilir
        c = np.roll(corners, 0, axis=0)
        order = [[0, 1, 2, 3], [2, 0, 3, 1], [3, 2, 1, 0], [1, 3, 0, 2]][rot]
        src = c[order]
        M = cv2.getPerspectiveTransform(src, REF)
        wgray = cv2.warpPerspective(gray, M, (L.W, L.H), flags=cv2.INTER_AREA, borderValue=255)
        sc = ring_score(wgray, nq)
        if best is None or sc > best[0]:
            best = (sc, wgray)
    return best


def normalize(g):
    bg = cv2.morphologyEx(g, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
    bg = cv2.GaussianBlur(bg, (0, 0), 9)
    return cv2.divide(g, np.maximum(bg, 1), scale=255)


def fill_fraction(norm, centers, thr=185):
    mask = _disc_mask(L.SAMPLE_R)
    out = []
    for p in _patches(norm, centers, L.SAMPLE_R):
        if p.shape != mask.shape:
            out.append(0.0)
            continue
        out.append(float((p[mask] < thr).mean()))
    return out


def decide(f):
    """Bir satırın doluluk oranlarından karar: (indeks | None | 'X', uyarı | None)"""
    order = np.argsort(f)[::-1]
    top, second = f[order[0]], f[order[1]]
    if top < 0.30:
        return None, None
    if second >= 0.30 and top - second < 0.25:
        return "X", "birden fazla işaret"
    return int(order[0]), ("silik işaret" if top < 0.50 else None)


def read_sheet(img, nq):
    h, w = img.shape[:2]
    scale = 2200 / max(h, w)
    if scale < 1:
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    corners = find_markers(gray)
    sc, wg = warp_best(gray, corners, nq)
    if sc < 25:
        raise SheetError("Form hizalanamadı (baloncuklar beklenen yerde değil). Doğru formu ve %100 ölçekli baskıyı kullandığından emin ol")
    norm = normalize(wg)
    warns = []
    digits = ""
    for d in range(L.NUM_DIGITS):
        k, w_ = decide(fill_fraction(norm, L.num_pos(d)))
        if k is None:
            digits += "_"
        elif k == "X":
            digits += "?"; warns.append(f"öğrenci no {d + 1}. basamak: çoklu işaret")
        else:
            digits += str(k)
            if w_: warns.append(f"öğrenci no {d + 1}. basamak: {w_}")
    answers = []
    for i in range(nq):
        k, w_ = decide(fill_fraction(norm, L.q_pos(i)))
        answers.append("-" if k is None else "*" if k == "X" else L.CHOICES[k])
        if w_:
            warns.append(f"soru {i + 1}: {w_}")
    return {"student_no": digits, "answers": "".join(answers), "warnings": warns, "align": round(float(sc), 1)}, wg, norm


def grade(answers, key, wrong_div=4.0):
    c = w = b = 0
    for a, k in zip(answers, key):
        if k == "-":
            continue                                       # anahtarda tanımsız soru
        if k == "*":
            c += 1; continue                               # iptal: herkese doğru
        if a in "-*":
            b += 1                                         # boş ya da çoklu işaret: ne doğru ne yanlış
        elif a == k:
            c += 1
        else:
            w += 1
    return {"correct": c, "wrong": w, "blank": b, "net": round(c - w / wrong_div, 2)}


def debug_image(wg, nq, res):
    out = cv2.cvtColor(wg, cv2.COLOR_GRAY2BGR)
    for i in range(nq):
        a = res["answers"][i]
        for k, (x, y) in enumerate(L.q_pos(i)):
            col = (0, 160, 0) if a == L.CHOICES[k] else (0, 0, 220) if a == "*" else None
            if col:
                cv2.circle(out, (int(x), int(y)), L.R + 3, col, 2)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", help="görüntü, PDF ya da klasör")
    ap.add_argument("--questions", type=int, required=True)
    ap.add_argument("--key", default="", help="cevap anahtarı, ör. ABCDE-*  ('-' tanımsız, '*' iptal=herkese doğru)")
    ap.add_argument("--key-file", default="")
    ap.add_argument("--wrong-div", type=float, default=4.0, help="kaç yanlış bir doğruyu götürür (DGS/YKS 4, LGS 3)")
    ap.add_argument("--out", default="out/sonuc")
    ap.add_argument("--debug", default="", help="hizalanmış ve işaretlenmiş görüntüleri bu klasöre yaz")
    a = ap.parse_args()
    key = (open(a.key_file, encoding="utf-8").read() if a.key_file else a.key).strip().upper().replace(" ", "").replace("\n", "")
    if key and len(key) != a.questions:
        sys.exit(f"Cevap anahtarı {len(key)} karakter, soru sayısı {a.questions}: eşleşmiyor")
    if key and set(key) - set(L.CHOICES + "-*"):
        sys.exit("Cevap anahtarında yalnızca A-E, '-' ve '*' olabilir")
    files = sorted(set(sum((glob.glob(os.path.join(a.input, e)) for e in ("*.jpg", "*.jpeg", "*.png", "*.pdf", "*.JPG", "*.PNG", "*.PDF")), []))) if os.path.isdir(a.input) else [a.input]
    if not files:
        sys.exit("Girdi bulunamadı")
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    if a.debug:
        os.makedirs(a.debug, exist_ok=True)
    rows = []
    for fp in files:
        try:
            pages = list(load_pages(fp))
        except Exception as e:
            rows.append({"file": os.path.basename(fp), "error": f"açılamadı: {e}"}); continue
        for name, img in pages:
            try:
                res, wg, _ = read_sheet(img, a.questions)
                row = {"file": name, **res}
                if key:
                    row.update(grade(res["answers"], key, a.wrong_div))
                if a.debug:
                    cv2.imencode(".jpg", debug_image(wg, a.questions, res))[1].tofile(os.path.join(a.debug, os.path.splitext(name)[0].replace("#", "_") + ".jpg"))
            except SheetError as e:
                row = {"file": name, "error": str(e)}
            rows.append(row)
            print(f"{name}: " + (row.get("error") or f"no={row['student_no']} " + (f"net={row['net']} " if key else "") + (f"({len(row['warnings'])} uyarı)" if row["warnings"] else "tamam")))
    with open(a.out + ".json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    cols = ["file", "student_no", "correct", "wrong", "blank", "net", "answers", "warnings", "error"]
    with open(a.out + ".csv", "w", encoding="utf-8-sig", newline="") as f:     # BOM: Türkçe Excel doğru açar
        wr = csv.writer(f, delimiter=";")
        wr.writerow(["dosya", "ogrenci_no", "dogru", "yanlis", "bos", "net", "cevaplar", "uyarilar", "hata"])
        for r in rows:
            wr.writerow([(" | ".join(r[c]) if c == "warnings" and c in r else r.get(c, "")) for c in cols])
    bad = sum(1 for r in rows if "error" in r)
    print(f"\n{len(rows)} form okundu, {bad} hatalı. Sonuç: {a.out}.csv / .json. Uyarılı ve hatalı formları gözle kontrol et.")


if __name__ == "__main__":
    main()
