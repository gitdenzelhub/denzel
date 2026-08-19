"""
Turn brand logos into alpha silhouettes.

    python tools/normalize_logos.py

Reads every image in logo-sources/ and writes a matching PNG into
assets/logos/, keeping the filename so content.md never has to change.

Why: the partner wall has to sit on five different grounds, and the logos
arrive in three incompatible forms — dark marks on transparency (HOKA),
light marks on transparency (Fitness Nation), and light marks baked onto
an opaque coloured square (OMA, LFG). No single CSS filter can handle all
three: knocking them out to white turns the opaque squares into solid
white blocks, and leaving them alone makes the white marks vanish on a
white ground.

Storing each logo as a silhouette (black pixels, real alpha) removes the
problem at the source. One filter then reads correctly everywhere: black
on the light palettes, inverted to white on the dark ones.

Needs Pillow, and is only run by hand when a logo changes. The site build
(build.py) never touches images, so GitHub Actions needs no extra deps.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "logo-sources"
DEST = ROOT / "assets" / "logos"

# How far a pixel must sit from the background colour before it counts as
# part of the mark. The floor discards JPEG ringing around a flat ground;
# the span keeps antialiased edges as partial alpha instead of stairsteps.
NOISE_FLOOR = 40.0
EDGE_SPAN = 90.0

PAD = 0.02          # breathing room around the mark, as a share of its size


def alpha_from_transparency(im):
    """The image already carries a usable alpha channel."""
    return im.getchannel("A")


def alpha_from_background(im):
    """Opaque image: derive alpha from distance to the corner colour."""
    w, h = im.size
    px = im.load()
    bg = px[0, 0][:3]

    mask = Image.new("L", (w, h))
    out = mask.load()
    br, bg_, bb = bg

    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            dist = ((r - br) ** 2 + (g - bg_) ** 2 + (b - bb) ** 2) ** 0.5
            v = (dist - NOISE_FLOOR) / EDGE_SPAN
            out[x, y] = 0 if v <= 0 else (255 if v >= 1 else int(v * 255))

    return mask


def normalize(path):
    im = Image.open(path).convert("RGBA")
    alpha = im.getchannel("A")

    # A real alpha channel means a good chunk of the image is see-through.
    transparent_share = alpha.histogram()[0] / (im.width * im.height)
    if transparent_share > 0.05:
        mask = alpha_from_transparency(im)
        how = "alpha"
    else:
        mask = alpha_from_background(im)
        how = "background knockout"

    # Black mark, real alpha. CSS decides the colour from here.
    silhouette = Image.new("RGBA", im.size, (0, 0, 0, 0))
    silhouette.putalpha(mask)

    # Crop to the mark so every logo carries the same optical weight,
    # rather than inheriting whatever padding its source file had.
    box = mask.getbbox()
    if box:
        pad_x = int((box[2] - box[0]) * PAD)
        pad_y = int((box[3] - box[1]) * PAD)
        box = (
            max(0, box[0] - pad_x), max(0, box[1] - pad_y),
            min(im.width, box[2] + pad_x), min(im.height, box[3] + pad_y),
        )
        silhouette = silhouette.crop(box)

    return silhouette, how


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    for src in sorted(SOURCE.glob("*.png")) + sorted(SOURCE.glob("*.jpg")):
        mark, how = normalize(src)
        out = DEST / (src.stem + ".png")
        mark.save(out, optimize=True)
        print(f"{src.name:26} -> {out.name:26} {str(mark.size):12} via {how}")


if __name__ == "__main__":
    main()
