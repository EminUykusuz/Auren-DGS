"""Auren Study brag: müzik + efektler, tek vuruş ızgarasında (0'dan sayılır, 120 BPM, 1 vuruş = 0,5 sn).
La minör: Am | F | C | G, her ölçü 2 sn. Çıktı: audio.wav (44,1 kHz stereo, 28 sn)."""
import sys, wave
import numpy as np

SR = 44100; DUR = 28.0; N = int(SR * DUR); BEAT = 0.5
rng = np.random.default_rng(11)
t_ = np.arange(N) / SR

# ---------- yardımcılar ----------
def fftconv(x, h):
    n = len(x) + len(h) - 1; m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(h, m), m)[:len(x)]
def lp(x, fc):                      # tek kutuplu alçak geçiren (üstel çekirdek)
    a = 1 - np.exp(-2 * np.pi * fc / SR); k = a * (1 - a) ** np.arange(int(SR * 0.05) if fc > 400 else int(SR * 0.3))
    return fftconv(x, k)
def hp(x, fc): return x - lp(x, fc)
def env(n, a=0.002, d=0.2, curve=4.0):
    t = np.arange(n) / SR; e = np.exp(-t * curve / max(d, 1e-3)); e[:int(a * SR) + 1] *= np.linspace(0, 1, int(a * SR) + 1) if int(a * SR) > 0 else 1
    return e
def sine(f, n, ph=0.0): return np.sin(2 * np.pi * f * np.arange(n) / SR + ph)
def saw(f, n): return 2 * ((f * np.arange(n) / SR) % 1.0) - 1
def noise(n): return rng.standard_normal(n)

dry = np.zeros((2, N)); wet = np.zeros((2, N)); duck_src = np.zeros(N)   # duck_src: kick zamanları
def put(bus, sig, t, g=1.0, pan=0.0, send=0.0):
    i = int(round(t * SR));
    if i >= N or i < 0: return
    sig = sig[: N - i]; l = g * np.cos((pan + 1) * np.pi / 4); r = g * np.sin((pan + 1) * np.pi / 4)
    bus[0, i:i + len(sig)] += sig * l; bus[1, i:i + len(sig)] += sig * r
    if send: wet[0, i:i + len(sig)] += sig * l * send; wet[1, i:i + len(sig)] += sig * r * send

# ---------- müzik teorisi ----------
CH = [  # ölçü başına: kök (bas), pad notaları, arp notaları
    (110.00, [220.00, 261.63, 329.63], [440.00, 523.25, 659.25, 880.00]),      # Am
    (87.31,  [174.61, 220.00, 261.63], [349.23, 440.00, 523.25, 698.46]),      # F
    (130.81, [261.63, 329.63, 392.00], [523.25, 659.25, 783.99, 1046.50]),     # C
    (98.00,  [196.00, 246.94, 293.66], [392.00, 493.88, 587.33, 783.99]),      # G
]
bar_of = lambda t: CH[int(t // 2) % 4]

# ---------- sesler ----------
def kick(): n = int(SR * 0.45); t = np.arange(n) / SR; f = 45 + 110 * np.exp(-t * 28); ph = 2 * np.pi * np.cumsum(f) / SR; return np.sin(ph) * np.exp(-t * 9) + 0.25 * noise(n) * np.exp(-t * 400)
def clap():
    n = int(SR * 0.28); x = np.zeros(n)
    for o, g in [(0, .7), (0.011, .8), (0.022, 1.0)]: i = int(o * SR); m = n - i; x[i:] += g * hp(noise(m), 1200) * np.exp(-np.arange(m) / SR * (30 if o < .02 else 16))
    return lp(x, 7500) * 0.5
def hat(open_=False): n = int(SR * (0.22 if open_ else 0.05)); return hp(noise(n), 7000) * env(n, 0.001, 0.2 if open_ else 0.04, 5) * 0.35
def snare(g=1.0): n = int(SR * 0.2); return (hp(noise(n), 1800) * env(n, 0.001, 0.14, 5) * 0.5 + sine(190, n) * env(n, 0.001, 0.08, 5) * 0.4) * g
def pluck(f, d=0.5, bright=1.0):
    n = int(SR * d); x = sine(f, n) + 0.35 * sine(2 * f, n) * np.exp(-np.arange(n) / SR * 14) * bright + 0.15 * sine(3 * f, n) * np.exp(-np.arange(n) / SR * 24) * bright
    return x * env(n, 0.003, d * 0.8, 5)
def bell(f, d=1.6): n = int(SR * d); x = sine(f, n) + 0.4 * sine(f * 2.76, n) * np.exp(-np.arange(n) / SR * 3) + 0.25 * sine(f * 5.4, n) * np.exp(-np.arange(n) / SR * 6); return x * env(n, 0.002, d, 4.5)
def sub(f, d): n = int(SR * d); return np.tanh(1.6 * sine(f, n)) * env(n, 0.006, d, 3.2) * 0.7
def sweep(d, up=True, g=1.0):   # filtrelenmiş gürültü süpürmesi; up: kapanışta en parlak (varış vuruşuna biter)
    n = int(SR * d); x = noise(n); out = np.zeros(n); k = 24; seg = n // k
    for j in range(k):
        fc = 300 * (40 ** ((j / k) if up else (1 - j / k))); a = slice(j * seg, (j + 1) * seg if j < k - 1 else n)
        out[a] = (hp(lp(noise(n), min(fc * 1.8, 14000)), fc * 0.5))[a]
    e = (np.linspace(0, 1, n) ** 1.6) if up else (np.linspace(1, 0, n) ** 1.6); return out * e * g * 0.4
def tick(low=False): n = int(SR * 0.06); x = sine(1300 if low else 1900, n) * env(n, 0.0005, 0.03, 6) + hp(noise(n), 3000) * env(n, 0.0005, 0.01, 6) * 0.6; return x * 0.5
def impact(g=1.0): n = int(SR * 1.8); return (sub(55, 1.8)[:n] * 1.0 + lp(noise(n), 4000) * env(n, 0.002, 1.2, 4) * 0.35) * g
def pad_note(f, d, g=1.0):
    n = int(SR * d); x = sum(saw(f * (1 + dt), n) for dt in (-0.006, 0.0, 0.006)) / 3; x = lp(x, 1400) + 0.5 * sine(f, n)
    a = min(0.9, d * 0.3); e = np.minimum(1, np.arange(n) / (a * SR)) * np.minimum(1, (n - np.arange(n)) / (0.6 * SR)); return x * e * g

# ---------- yerleşim ----------
beats = np.arange(0, DUR, BEAT)
KICK_T = [b for b in beats if (5.5 <= b < 21.75)]
for b in KICK_T: put(dry, kick(), b, 0.95); duck_src[int(b * SR)] = 1
put(dry, kick() * 1.15, 22.0, 1.0); duck_src[int(22.0 * SR)] = 1

# pad: ölçü başına akor (0–28); lamba söndüğünde 5.0–5.5 sessiz
padbus = np.zeros((2, N))
for bi in range(14):
    t0 = bi * 2.0; root, notes, _ = CH[bi % 4]
    for j, f in enumerate(notes):
        pn = pad_note(f, 2.4)
        put(padbus, pn, t0, 0.20, pan=(-0.5, 0, 0.5)[j])
gain = np.interp(t_, [0, 1.0, 4.4, 5.0, 5.2, 5.5, 8, 12, 21.8, 22.0, 26.4, 28], [0, .55, .7, .5, 0.0, .25, .75, .8, .8, 1.0, .9, 0])
padbus *= gain

# bas: 5.5'ten; sekizlik darbeler (kök), 12'den sonra tam
bassbus = np.zeros((2, N))
for b in np.arange(5.5, 21.75, 0.5):
    root = bar_of(b)[0]; g = 0.55 if b < 12 else 0.85
    if (b % 1.0) == 0.5 or b < 12 and (b * 2) % 4 == 0: put(bassbus, sub(root, 0.4), b, g)
put(bassbus, sub(55, 1.8), 22.0, 0.9)
# 22–28 final: yumuşak bas nabzı
for b in np.arange(22.5, 26.5, 2.0): put(bassbus, sub(bar_of(b)[0], 1.5), b, 0.35)

# hi-hat 8.0–21.5 (vuruş dışı sekizlikler), açık hat ölçü sonu
for b in np.arange(8.0, 21.75, 0.5):
    if (b % 1.0) == 0.5: put(dry, hat(open_=(b % 2.0) == 1.5), b, 0.55, pan=0.25)
    elif b >= 12: put(dry, hat(), b, 0.25, pan=-0.2)
# klap: 12–21.5, her ölçünün 2. ve 4. vuruşu
for b in np.arange(12.0, 21.75, 0.5):
    if int(round(b / 0.5)) % 4 in (1, 3): put(dry, clap(), b, 0.7, send=0.18)
# snare roll 3.5–5.0
for b in np.arange(3.5, 5.0, 0.25): put(dry, snare(0.25 + 0.6 * (b - 3.5) / 1.5), b, 1.0, pan=0.1)

# arp: 12–21.5, sekizlikler
arpbus = np.zeros((2, N))
pat = [0, 1, 2, 3, 2, 1, 2, 3]
for k, b in enumerate(np.arange(12.0, 21.75, 0.5)):
    notes = bar_of(b)[2]; f = notes[pat[k % 8]]; put(arpbus, pluck(f, 0.55), b, 0.34, pan=-0.45 if k % 2 else 0.45, send=0.55)
# 8.0–12.0: çok hafif tek notalar (eşlik)
for b in np.arange(8.0, 12.0, 1.0):
    put(arpbus, pluck(bar_of(b)[2][0], 0.9, 0.7), b, 0.22, send=0.6)

# kick'e duyarlı yan zincir (pad/arp/bas kick'te yumuşakça çekilir)
def sidechain(bus, amt=0.55, rel=0.16):
    e = fftconv(duck_src, np.exp(-np.arange(int(SR * 0.6)) / SR / rel * 3)); e = np.clip(e, 0, 1); return bus * (1 - amt * e)
padbus = sidechain(padbus, 0.5); arpbus = sidechain(arpbus, 0.35); bassbus = sidechain(bassbus, 0.4)
dry += padbus + arpbus + bassbus; wet += padbus * 0.3 + arpbus * 0.0

# ---------- efektler (aynı oda: reverb gönderimi) ----------
fx = np.zeros((2, N)); fxw = np.zeros((2, N))
def fput(sig, t, g=1.0, pan=0.0, send=0.5):
    put(fx, sig, t, g, pan, 0.0);
    i = int(round(t * SR))
    if i < N: s = sig[: N - i]; fxw[0, i:i + len(s)] += s * g * send; fxw[1, i:i + len(s)] += s * g * send
# saat tıkırtısı (sahne 1)
for k, t in enumerate([1.0, 2.0, 3.0, 4.0, 4.5]): fput(tick(low=(k % 2 == 1)), t, 0.5, send=0.15)
# kelime girişleri: yumuşak çanlar
fput(bell(659.25, 1.2), 0.5, 0.16, send=0.7); fput(bell(880.0, 1.4), 2.5, 0.18, send=0.7)
# yükselme (3.5→5.0) ve lamba klik (5.0)
fput(sweep(1.45, up=True, g=0.9), 3.5, 0.5, send=0.4)
fput(hp(noise(int(SR * 0.012)), 1500) * env(int(SR * 0.012), 0.0003, 0.008, 6) * 1.2, 4.95, 0.9, send=0.1)
fput(sine(70, int(SR * 0.25)) * env(int(SR * 0.25), 0.001, 0.18, 5) * 0.9, 4.98, 0.8, send=0.0)
# logo: 5.5 tile, 5.5–6.5 çizim pluck'ları (Am), 6.5 nokta çanı
fput(sub(55, 1.4), 5.5, 0.5, send=0.2)
for f, t in [(440.0, 5.5), (523.25, 6.0), (659.25, 6.5)]: fput(pluck(f, 0.9, 1.1), t, 0.35, pan=0.2, send=0.6)
fput(bell(1318.5, 2.2), 6.5, 0.28, send=0.7)
fput(sweep(0.5, up=False, g=0.6), 6.5, 0.3, send=0.5)
# tagline: üç çan (E5, G5, A5)
for f, t in [(659.25, 8.0), (783.99, 9.0), (880.0, 10.0)]: fput(bell(f, 1.2), t, 0.2, send=0.6)
fput(sweep(0.5, up=False, g=0.8), 8.0, 0.4)
# 11.5→12.0 yükselme + 12.0 vuruşu
fput(sweep(0.6, up=True, g=1.0), 11.4, 0.55)
fput(impact(0.8), 12.0, 0.6, send=0.2)
# alt sahne geçişleri: süpürme + yumuşak darbe
for tt in (14.5, 17.0, 19.5): fput(sweep(0.35, up=True, g=0.8), tt - 0.35, 0.4); fput(impact(0.45), tt, 0.5, send=0.15)
# arayüz blipleri (görüntüdeki zamanlarla aynı, 16'lık ızgara)
blip = lambda f: pluck(f, 0.3, 1.2)
PENT = [659.25, 783.99, 880.0, 987.77, 1174.66, 1318.5]
fput(blip(PENT[0]), 12.5, 0.18, send=0.4)
for i in range(4): fput(blip(PENT[i % 5 + 0]), 12.75 + 0.25 * i, 0.16, pan=-0.2, send=0.4)
fput(blip(PENT[2]), 15.0, 0.18, send=0.4)
for i in range(5): fput(blip(PENT[i]), 15.25 + 0.25 * i, 0.16, pan=0.2, send=0.4)
for i in range(5): fput(blip(PENT[[1, 2, 3, 2, 4][i]]), 17.25 + 0.25 * i, 0.15, pan=-0.2, send=0.4)
for i in range(4): fput(blip(PENT[[2, 3, 4, 5][i]]), 20.25 + 0.25 * i, 0.15, pan=0.2, send=0.4)
# final (22.0)
fput(sweep(0.35, up=True, g=1.0), 21.65, 0.5); fput(impact(1.2), 22.0, 0.9, send=0.3)
for j, f in enumerate([440.0, 523.25, 659.25, 880.0]): fput(bell(f, 3.5), 22.0 + 0.02 * j, 0.14, send=0.7)
fput(bell(880.0, 2.4), 23.0, 0.18, send=0.7); fput(bell(1318.5, 3.0), 24.5, 0.16, send=0.8)
fput(pluck(659.25, 1.2), 22.5, 0.2, send=0.6)

# ---------- reverb (ortak oda) ----------
def make_ir(d=2.4):
    n = int(SR * d); ir = np.zeros((2, n))
    for c in range(2):
        x = noise(n) * np.exp(-np.arange(n) / SR * 2.6); x = lp(x, 5500); x[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR)); ir[c] = x
    return ir / np.sqrt((ir ** 2).sum() / 2)
IR = make_ir()
verb = np.stack([fftconv(wet[c] + fxw[c], IR[c]) for c in range(2)]) * 0.4
mix = dry + fx * 1.0 + verb * 1.0

# ---------- master ----------
mix = np.tanh(mix * 0.9) / np.tanh(0.9)
tail = np.interp(t_, [0, 0.02, 26.6, 28.0], [0, 1, 1, 0])          # son 1,4 sn yumuşak söner
mix *= tail
mix = np.stack([hp(mix[0], 28), hp(mix[1], 28)])   # DC / aşırı sub temizliği
mix *= 10 ** (-1.2 / 20) / np.abs(mix).max()
pcm = (np.clip(mix, -1, 1).T * 32767).astype('<i2')
with wave.open('audio.wav', 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', pcm.shape, 'tepe', np.abs(mix).max())
