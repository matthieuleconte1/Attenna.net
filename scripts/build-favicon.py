"""Génère les favicons du site à partir du logo Attenna (pictures/icon.png).

On garde le « A » et le « . » du logo « A.net », avec leurs proportions et leur
position d'origine, et on retire le « net ». Le point passe en orange d'accent.
L'ensemble est centré sur un carré uni, sans effet.

Les éléments du logo sont isolés par composantes connexes plutôt que par une
boîte fixe, ce qui évite de rogner le « A ».
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "pictures" / "icon.png"
OUT = ROOT / "pictures"

BACKGROUND = (8, 6, 4)  # #080604, --site-bg
FOREGROUND = (255, 255, 255)
ACCENT = (237, 106, 12)  # #ed6a0c, l'orange d'accent du site
SUPERSAMPLE = 4
MARGIN = 0.2  # marge autour du « A. », en fraction du côté

# Aux petites tailles, le trait fin du logo disparaît : on réduit la marge et on
# épaissit légèrement le trait (rayon en pixels finaux).
SMALL = {16: (0.1, 0.2), 32: (0.13, 0.3)}


def extract_marks() -> tuple[Image.Image, Image.Image]:
    """Renvoie les masques du « A » et du point, cadrés sur « A. »."""
    alpha = Image.open(SOURCE).getchannel("A")
    labels, _ = ndimage.label(np.array(alpha) > 20)
    boxes = ndimage.find_objects(labels)

    # Le « A » est la composante la plus à gauche, le point la plus petite.
    letter_id = min(range(len(boxes)), key=lambda i: boxes[i][1].start) + 1
    dot_id = min(range(len(boxes)), key=lambda i: (labels[boxes[i]] == i + 1).sum()) + 1

    left = min(boxes[letter_id - 1][1].start, boxes[dot_id - 1][1].start)
    top = min(boxes[letter_id - 1][0].start, boxes[dot_id - 1][0].start)
    right = max(boxes[letter_id - 1][1].stop, boxes[dot_id - 1][1].stop)
    bottom = max(boxes[letter_id - 1][0].stop, boxes[dot_id - 1][0].stop)

    source = np.array(alpha)
    crop = (slice(top, bottom), slice(left, right))
    letter = np.where(labels[crop] == letter_id, source[crop], 0).astype(np.uint8)
    dot = np.where(labels[crop] == dot_id, source[crop], 0).astype(np.uint8)
    return Image.fromarray(letter), Image.fromarray(dot)


LETTER, DOT = extract_marks()


def build_icon(size: int, *, rounded: bool = True) -> Image.Image:
    """Compose une icône carrée au format demandé."""
    work = size * SUPERSAMPLE
    canvas = Image.new("RGBA", (work, work), (0, 0, 0, 0))

    shape = Image.new("L", (work, work), 0)
    if rounded:
        ImageDraw.Draw(shape).rounded_rectangle((0, 0, work - 1, work - 1), radius=int(work * 0.22), fill=255)
    else:
        shape.paste(255, (0, 0, work, work))
    canvas.paste(BACKGROUND + (255,), (0, 0), shape)

    # « A. » mis à l'échelle pour tenir dans le carré, marges comprises.
    margin, boost = SMALL.get(size, (MARGIN, 0))
    inner = work * (1 - 2 * margin)
    scale = inner / max(LETTER.size)
    width, height = round(LETTER.width * scale), round(LETTER.height * scale)
    x, y = (work - width) // 2, (work - height) // 2
    for mask, color in ((LETTER, FOREGROUND), (DOT, ACCENT)):
        mask = mask.resize((width, height), Image.LANCZOS)
        if boost:
            radius = round(boost * SUPERSAMPLE)
            mask = mask.filter(ImageFilter.MaxFilter(radius * 2 + 1))
        canvas.paste(color + (255,), (x, y), mask)

    return canvas.resize((size, size), Image.LANCZOS)


def main() -> None:
    build_icon(512).save(OUT / "favicon-512.png")
    build_icon(192).save(OUT / "favicon-192.png")
    build_icon(32).save(OUT / "favicon-32.png")
    build_icon(180, rounded=False).save(OUT / "apple-touch-icon.png")

    # Une image par taille dans le .ico, plutôt qu'une seule image réduite.
    ico_sizes = [16, 32, 48, 64, 128, 256]
    frames = [build_icon(s) for s in ico_sizes]
    frames[-1].save(
        OUT / "favicon.ico",
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=frames[:-1],
    )

    for name in ("favicon.ico", "favicon-32.png", "favicon-192.png", "favicon-512.png", "apple-touch-icon.png"):
        path = OUT / name
        print(f"{name}: {path.stat().st_size} octets")


if __name__ == "__main__":
    main()
