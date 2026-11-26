"""Optik form yerleşimi: üretici (make_sheet.py) ve okuyucu (read.py) aynı sabitleri kullanır.
Kanonik uzayda A4, 150 dpi: 1240x1754 piksel. Köşelerde 4 dolu kare işaret bulunur; okuyucu bunlarla perspektifi düzeltir."""
W, H = 1240, 1754
MARK = 56                       # köşe işaretinin kenarı
MARK_C = [(60, 60), (W - 60, 60), (60, H - 60), (W - 60, H - 60)]   # sol-üst, sağ-üst, sol-alt, sağ-alt merkezleri
R = 11                          # baloncuk yarıçapı (halka)
SAMPLE_R = 6                    # ölçüm yarıçapı (halkaya değmesin)
CHOICES = "ABCDE"
CH_DX = 34                      # seçenekler arası
ROW_DY = 30                     # soru satırı aralığı
COLS = 4
ROWS_PER_COL = 30
MAX_Q = COLS * ROWS_PER_COL
COL_X0 = [110 + c * 275 for c in range(COLS)]
ANS_Y0 = 720
NUM_DIGITS = 8                  # öğrenci numarası basamak sayısı
NUM_X0, NUM_DX = 150, 40
NUM_Y0, NUM_DY = 360, 30


def q_pos(i):
    """i. sorunun (0'dan) seçenek merkezleri: [(x, y) x 5]"""
    col, row = divmod(i, ROWS_PER_COL)
    y = ANS_Y0 + row * ROW_DY
    x0 = COL_X0[col] + 44
    return [(x0 + k * CH_DX, y) for k in range(len(CHOICES))]


def q_label_pos(i):
    col, row = divmod(i, ROWS_PER_COL)
    return COL_X0[col], ANS_Y0 + row * ROW_DY


def num_pos(d):
    """d. basamağın 0-9 baloncuk merkezleri"""
    x = NUM_X0 + d * NUM_DX
    return [(x, NUM_Y0 + k * NUM_DY) for k in range(10)]
