"""Génère les favicons du site à partir du monogramme « A » du logo Attenna.

Le logo complet (pictures/icon.png) a un ratio de 1,88:1 et devient illisible
une fois réduit à 32x32. On isole donc le premier glyphe, on le pose sur un
carré sombre arrondi et on ajoute le point orange repris du « . » de « A.net ».
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "pictures" / "icon.png"
OUT = ROOT / "pictures"

# Boîte du glyphe « A » seul, mesurée sur le canal alpha du logo source.
GLYPH_BOX = (299, 288, 1410, 1598)

BACKGROUND = (23, 23, 23, 255)  # #171717, le fond sombre du site
ACCENT = (237, 106, 12, 255)  # #ed6a0c, l'orange d'accent du site
SUPERSAMPLE = 4


def build_icon(size: int, *, rounded: bool = True, dot: bool = True) -> Image.Image:
    """Compose une icône carrée au format demandé."""
    work = size * SUPERSAMPLE
    canvas = Image.new("RGBA", (work, work), (0, 0, 0, 0))

    # Fond : carré aux angles arrondis (ou plein pour l'icône Apple).
    background = Image.new("RGBA", (work, work), (0, 0, 0, 0))
    draw = ImageDraw.Draw(background)
    if rounded:
        draw.rounded_rectangle((0, 0, work - 1, work - 1), radius=int(work * 0.22), fill=BACKGROUND)
    else:
        draw.rectangle((0, 0, work - 1, work - 1), fill=BACKGROUND)
    canvas.alpha_composite(background)

    # Glyphe « A » redimensionné en conservant ses proportions.
    glyph = Image.open(SOURCE).convert("RGBA").crop(GLYPH_BOX)
    target_height = int(work * 0.55)
    target_width = max(1, round(glyph.width * target_height / glyph.height))
    glyph = glyph.resize((target_width, target_height), Image.LANCZOS)

    # Le glyphe est légèrement remonté pour laisser respirer le point orange.
    offset_x = (work - target_width) // 2
    offset_y = int((work - target_height) * 0.38)
    canvas.alpha_composite(glyph, (offset_x, offset_y))

    # Point orange, rappel du « . » de « A.net ».
    if dot:
        radius = work * 0.072
        center_x = work * 0.5
        center_y = offset_y + target_height + work * 0.105
        overlay = ImageDraw.Draw(canvas)
        overlay.ellipse(
            (center_x - radius, center_y - radius, center_x + radius, center_y + radius),
            fill=ACCENT,
        )

    return canvas.resize((size, size), Image.LANCZOS)


def main() -> None:
    build_icon(512).save(OUT / "favicon-512.png")
    build_icon(192).save(OUT / "favicon-192.png")
    build_icon(32).save(OUT / "favicon-32.png")
    build_icon(180, rounded=False).save(OUT / "apple-touch-icon.png")

    # Le .ico embarque plusieurs tailles pour les onglets et les raccourcis.
    build_icon(256).save(
        OUT / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    for name in ("favicon.ico", "favicon-32.png", "favicon-192.png", "favicon-512.png", "apple-touch-icon.png"):
        path = OUT / name
        print(f"{name}: {path.stat().st_size} octets")


if __name__ == "__main__":
    main()
