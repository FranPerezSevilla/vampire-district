"""Lossless transport encoding only: assert identical decoded pixels, keep PNG masters."""
from pathlib import Path
import json
from PIL import Image

root = Path(__file__).resolve().parents[2]
assets = root / 'phaser/assets'
files = ['architecture/district-civic-facades-v1.png',
         'architecture/district-industrial-facades-v1.png',
         'architecture/district-utility-objects-v1.png',
         'police/facade-v2.png', 'vesper/facade-v2.png',
         'cathedral/facade-atlas-v2.png', 'cathedral/front-v2.png']
report = []
for name in files:
    src = assets / name
    dst = src.with_suffix('.webp')
    with Image.open(src) as original:
        pixels = original.convert('RGBA')
        pixels.save(dst, 'WEBP', lossless=True, method=6,
                    icc_profile=original.info.get('icc_profile', b''))
        with Image.open(dst) as encoded:
            assert encoded.convert('RGBA').tobytes() == pixels.tobytes(), name
        report.append(dict(source=name, runtime=dst.relative_to(assets).as_posix(),
                           size=list(pixels.size), pngBytes=src.stat().st_size,
                           webpBytes=dst.stat().st_size, pixelsIdentical=True))
        print(name, src.stat().st_size, '->', dst.stat().st_size, flush=True)
(root / 'docs/art-direction/city-district-asset-encoding.json').write_text(
    json.dumps(report, indent=2) + '\n', encoding='utf-8')
