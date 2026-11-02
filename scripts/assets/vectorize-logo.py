"""Vetoriza um logo de uma cor só (PNG) em SVG nítido, na cor grafite do site.

Requer: pip install potracer pillow numpy
Uso:
  python3 -I scripts/assets/vectorize-logo.py <entrada.png> <saida.svg> [dark|light]

dark  = logo escuro sobre fundo claro/transparente (padrão)
light = logo claro sobre fundo transparente
O PNG é ampliado 4x antes de traçar, para as curvas saírem suaves.
"""
import sys

import numpy as np
import potrace
from PIL import Image

INK = "#1f1f1f"
SCALE = 4


def main():
    src, dst = sys.argv[1], sys.argv[2]
    mode = sys.argv[3] if len(sys.argv) > 3 else "dark"
    img = Image.open(src).convert("RGBA")
    a = np.asarray(img).astype(np.float32) / 255.0
    lum = a[..., :3] @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    ink = a[..., 3] * ((1 - lum) if mode == "dark" else lum)
    big = Image.fromarray((ink * 255).astype(np.uint8)).resize(
        (img.width * SCALE, img.height * SCALE), Image.BICUBIC
    )
    bits = np.asarray(big) > 127
    ys, xs = np.where(bits)
    pad = 6 * SCALE
    bits = bits[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    bits = np.pad(bits, pad)  # margem em volta evita bordas irregulares no traço
    h, w = bits.shape
    plist = potrace.Bitmap(~bits).trace(turdsize=8, alphamax=1.1, opttolerance=0.4)
    parts = []
    for curve in plist:
        s = curve.start_point
        d = [f"M{s.x:.1f},{s.y:.1f}"]
        for seg in curve.segments:
            if seg.is_corner:
                d.append(f"L{seg.c.x:.1f},{seg.c.y:.1f}L{seg.end_point.x:.1f},{seg.end_point.y:.1f}")
            else:
                d.append(
                    f"C{seg.c1.x:.1f},{seg.c1.y:.1f} {seg.c2.x:.1f},{seg.c2.y:.1f} "
                    f"{seg.end_point.x:.1f},{seg.end_point.y:.1f}"
                )
        d.append("Z")
        parts.append("".join(d))
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
        f'<path fill="{INK}" fill-rule="evenodd" d="{" ".join(parts)}"/></svg>'
    )
    with open(dst, "w", encoding="utf-8") as f:
        f.write(svg)
    print(dst, w, h, len(svg) // 1024, "KB")


if __name__ == "__main__":
    main()
