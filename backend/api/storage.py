"""
Photo storage in the local media folder (MEDIA_ROOT, default backend/media).

Model fields store the path relative to MEDIA_ROOT, e.g. "items/3f9c….jpg", and photos are
served from MEDIA_URL. File names are 128-bit random tokens, so the clear copy of a found
item can't be guessed; the API only hands its URL to the finder, admins and a verified
claimant (everyone else gets the blurred copy).
"""
import secrets
import shutil

from django.conf import settings


def save_image(folder, data, private=False):
    """Write JPEG bytes under MEDIA_ROOT/<folder>/ and return the relative path.

    `private` documents intent only: who may see a photo is decided by the serializers.
    """
    path = f"{folder}/{secrets.token_hex(16)}.jpg"
    target = settings.MEDIA_ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return path


def delete_image(path):
    """Remove a stored photo. A missing file is fine."""
    if not path:
        return
    try:
        (settings.MEDIA_ROOT / path).unlink(missing_ok=True)
    except OSError:
        pass


def image_url(path):
    """Browser URL for a stored photo."""
    return f"{settings.MEDIA_URL}{path}" if path else None


def delete_all():
    """Used by `seed_demo --reset`: remove every uploaded photo."""
    for folder in ("items", "claims"):
        shutil.rmtree(settings.MEDIA_ROOT / folder, ignore_errors=True)
