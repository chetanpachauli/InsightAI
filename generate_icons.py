import struct, zlib, os

def make_png(size, bg=(79,70,229), fg=(255,255,255)):
    w = h = size
    raw = []
    for y in range(h):
        row = [0]
        for x in range(w):
            cx, cy = w//2, h//2
            r = w//3
            dist = ((x-cx)**2 + (y-cy)**2) ** 0.5
            if dist <= r:
                row += list(fg) + [255]
            else:
                row += list(bg) + [255]
        raw.append(bytes(row))

    def chunk(name, data):
        c = struct.pack(">I", len(data)) + name + data
        return c + struct.pack(">I", zlib.crc32(name + data) & 0xffffffff)

    img_data = zlib.compress(b"".join(raw))
    ihdr_data = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr_data)
        + chunk(b"IDAT", img_data)
        + chunk(b"IEND", b"")
    )

out_dir = r"frontend\public\icons"
os.makedirs(out_dir, exist_ok=True)

for size in [72, 96, 128, 144, 152, 192, 384, 512]:
    png = make_png(size)
    path = os.path.join(out_dir, f"icon-{size}x{size}.png")
    with open(path, "wb") as f:
        f.write(png)
    print(f"Created icon-{size}x{size}.png")

print("Done!")
