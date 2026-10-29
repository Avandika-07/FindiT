import io

import pytest

from api.core.image_hash import dhash_image, dhash_pixels, hamming, hash_similarity

PIL = pytest.importorskip("PIL")
from PIL import Image, ImageDraw  # noqa: E402


def test_dhash_pixels_known_values():
    rising = [list(range(9)) for _ in range(8)]
    assert dhash_pixels(rising) == "f" * 16
    flat = [[5] * 9 for _ in range(8)]
    assert dhash_pixels(flat) == "0" * 16
    with pytest.raises(ValueError):
        dhash_pixels([[1, 2]])


def test_hamming_and_similarity():
    assert hamming("0" * 16, "f" * 16) == 64
    assert hamming("00000000000000ff", "0000000000000000") == 8
    assert hash_similarity("abcdef0123456789", "abcdef0123456789") == 100
    assert hash_similarity("0" * 16, "f" * 16) == 0


def _png(draw_fn, size=(200, 160)):
    img = Image.new("RGB", size, "white")
    draw_fn(ImageDraw.Draw(img))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def _gradient(shift):
    def draw(d):
        for x in range(200):
            v = min(255, max(0, x + shift))
            d.line([(x, 0), (x, 159)], fill=(v, v, v))
        d.ellipse([60, 40, 140, 120], fill=(20, 20, 200))
    return draw


def test_dhash_near_identical_vs_different(tmp_path):
    a = dhash_image(_png(_gradient(0)))
    b = dhash_image(_png(_gradient(4)))   # slightly brighter copy
    path = tmp_path / "other.png"
    other = Image.new("RGB", (200, 160), "black")
    d = ImageDraw.Draw(other)
    for x in range(200):
        v = 255 - x
        d.line([(x, 0), (x, 159)], fill=(v, v, v))
    other.save(path)
    c = dhash_image(str(path))
    assert len(a) == 16
    assert hash_similarity(a, b) >= 90
    assert hash_similarity(a, c) < hash_similarity(a, b)
    assert hash_similarity(a, c) < 60
