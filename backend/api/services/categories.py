"""Item categories: the built-in list plus kinds of items students add while reporting."""
import re

from ..http import ApiError
from ..models import CATEGORIES, CustomCategory

CUSTOM_ICON = "tag"
_LETTER = re.compile(r"[^\W\d_]")


def all_categories():
    """(name, icon) pairs: built-ins, then the added ones A to Z, with Other kept last."""
    builtin = [c for c in CATEGORIES if c[0] != "Other"]
    other = [c for c in CATEGORIES if c[0] == "Other"]
    return builtin + [(c.name, CUSTOM_ICON) for c in CustomCategory.objects.all()] + other


def resolve(value, user):
    """
    Return the stored spelling of the category `value` names. A name that isn't known yet
    is added as a new category, so the next person reporting one can pick it from the list.
    """
    name = " ".join(str(value).split())
    if not 2 <= len(name) <= 30 or not _LETTER.search(name):
        msg = "Name the kind of item in 2 to 30 characters, for example: Power bank."
        raise ApiError(400, "validation_error", msg, fields={"category": msg})
    key = name.lower()
    for builtin, _ in CATEGORIES:
        if builtin.lower() == key:
            return builtin
    if name.islower():
        name = name[0].upper() + name[1:]
    category, _ = CustomCategory.objects.get_or_create(key=key, defaults={"name": name, "created_by": user})
    return category.name
