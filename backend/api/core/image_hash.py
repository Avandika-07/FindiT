"""Photo fingerprints with a handwritten difference hash (dHash).

Pillow is used ONLY to open the image, turn it grey and shrink it to 9x8.
The fingerprint itself is computed by our own code in dhash_pixels().
"""


def dhash_pixels(pixels) -> str:
    """Turn an 8-row x 9-column grid of grey values into a 16-character hex fingerprint.

    For each row we compare each pixel with its right neighbour: bit = 1 if
    left < right. 8 rows x 8 comparisons = 64 bits = 16 hex characters.
    Similar-looking photos produce fingerprints that differ in few bits.
    Time: O(1) (always 72 pixels).
    """
    if len(pixels) != 8 or any(len(row) != 9 for row in pixels):
        raise ValueError("dhash_pixels needs 8 rows of 9 grayscale values")
    value = 0
    for row in pixels:
        for col in range(8):
            value = (value << 1) | (1 if row[col] < row[col + 1] else 0)
    return format(value, "016x")


def dhash_image(path_or_file) -> str:
    """Fingerprint an image file (path or open file object) with dHash.

    Pillow opens it, converts to grayscale and resizes to 9x8; then we read
    the 72 pixels and hand them to dhash_pixels().
    Time: O(image size) for Pillow's resize, O(1) for the hash itself.
    """
    from PIL import Image  # Pillow: open / convert / resize only

    with Image.open(path_or_file) as img:
        small = img.convert("L").resize((9, 8))
        pixels = [[small.getpixel((x, y)) for x in range(9)] for y in range(8)]
    return dhash_pixels(pixels)


def hamming(h1: str, h2: str) -> int:
    """Count how many of the 64 bits differ between two hex fingerprints.

    Time: O(1) (64 bits).
    """
    x = int(h1, 16) ^ int(h2, 16)
    count = 0
    while x:
        x &= x - 1  # clears the lowest set bit
        count += 1
    return count


def hash_similarity(h1: str, h2: str) -> int:
    """Photo similarity from 0 to 100: round(100 * (1 - differing_bits / 64)).

    Time: O(1).
    """
    return round(100 * (1 - hamming(h1, h2) / 64))
