"""Text helpers: stopwords, light stemming, tokenizing, synonyms, colours,
sound-alike keys and answer normalisation.

Everything here is handwritten with the standard library only.
"""

import re

# --------------------------------------------------------------------------
# Stopwords
# --------------------------------------------------------------------------

# Words that carry no meaning for lost-and-found search ("my lost phone" -> "phone").
STOPWORDS: frozenset = frozenset(
    """
    a an the my me i is was were are be been am in at on of and or with near
    lost found item it its to for from by this that these those some someone
    please left kept etc has have had he she they them their his her our we
    you your so but not no as into onto out up about around there here
    """.split()
)

_WORD_RE = re.compile(r"[a-z0-9]+")


# --------------------------------------------------------------------------
# Stemming and tokenizing
# --------------------------------------------------------------------------

# (suffix, replacement) rules, tried in this order. Only the first rule whose
# suffix matches is considered.
_STEM_RULES = [
    ("ings", ""),
    ("ing", ""),
    ("ies", "y"),
    ("sses", "ss"),
    ("xes", "x"),
    ("ches", "ch"),
    ("shes", "sh"),
    ("zes", "z"),
    ("ed", ""),
]


def stem(word: str) -> str:
    """Cut common English endings so "phones" and "phone" become the same word.

    Rules (first match wins): -ings, -ing, -ies->y, -sses/-xes/-ches/-shes/-zes
    drop "es", -ed, and a final "s" (but not -ss, -us, -is). Words shorter than
    4 letters are left alone, and a rule is only used if at least 3 letters
    remain.
    Time: O(L) where L is the word length.
    """
    if len(word) < 4:
        return word
    for suffix, repl in _STEM_RULES:
        if word.endswith(suffix):
            result = word[: len(word) - len(suffix)] + repl
            if len(result) >= 3:
                return result
            return word
    if word.endswith("s") and not word.endswith(("ss", "us", "is")):
        base = word[:-1]
        if len(base) >= 3:
            return base
    return word


def tokenize_with_surface(text: str) -> list:
    """Like tokenize() but returns (stemmed_token, original_lowercase_word) pairs.

    The original word lets the UI show "earphones" instead of the stem "earphone".
    Time: O(n) in the length of the text.
    """
    out = []
    for word in _WORD_RE.findall((text or "").lower()):
        if word in STOPWORDS:
            continue
        out.append((stem(word), word))
    return out


def tokenize(text: str) -> list:
    """Split text into meaningful, stemmed lowercase words (order and repeats kept).

    "My lost Blue Earphones!" -> ["blue", "earphone"].
    Time: O(n) in the length of the text.
    """
    return [tok for tok, _ in tokenize_with_surface(text)]


# --------------------------------------------------------------------------
# Synonyms
# --------------------------------------------------------------------------

_RAW_SYNONYM_GROUPS = [
    "phone mobile cellphone smartphone iphone fone",
    "earphone earbud bud airpod headphone headset tws neckband earpod",
    "spec spectacle glass eyeglass goggle",
    "bag backpack handbag sling pouch",
    "bottle flask sipper",
    "charger adapter cable wire",
    "powerbank",
    "id idcard identity card",
    "tiffin lunchbox",
    "wallet purse",
    "watch smartwatch band",
    "laptop notebook macbook",
    "calculator calci",
    "umbrella",
    "key keychain bunch",
]

# Each group holds STEMMED words so they line up with tokenize() output.
SYNONYM_GROUPS: list = [
    frozenset(stem(w) for w in _WORD_RE.findall(g)) for g in _RAW_SYNONYM_GROUPS
]


def _build_synonym_maps():
    """Precompute token -> synonyms and token -> canonical representative.

    Time: O(total group members squared) once at import - tiny.
    """
    syn = {}
    canon = {}
    for group in SYNONYM_GROUPS:
        rep = sorted(group)[0]
        for tok in group:
            syn.setdefault(tok, set()).update(group - {tok})
            canon.setdefault(tok, rep)
    return {k: frozenset(v) for k, v in syn.items()}, canon


_SYNONYMS, _CANONICAL = _build_synonym_maps()


def synonyms_of(token: str) -> frozenset:
    """Return the other words that mean the same thing ("fone" -> phone, mobile, ...).

    Time: O(1) dictionary lookup.
    """
    return _SYNONYMS.get(token, frozenset())


def canonical_token(token: str) -> str:
    """Return one fixed stand-in word for the token's synonym group.

    "earbud" and "headphone" both map to the same word, so the matcher counts
    them as equal. Words with no synonyms map to themselves.
    Time: O(1).
    """
    return _CANONICAL.get(token, token)


# --------------------------------------------------------------------------
# Colours
# --------------------------------------------------------------------------

COLOR_GROUPS: dict = {
    "blue": frozenset({"blue", "navy", "sky", "teal"}),
    "black": frozenset({"black", "dark"}),
    "white": frozenset({"white", "cream", "offwhite"}),
    "grey": frozenset({"grey", "gray", "silver"}),
    "red": frozenset({"red", "maroon", "crimson"}),
    "green": frozenset({"green", "olive"}),
    "brown": frozenset({"brown", "tan", "beige"}),
    "pink": frozenset({"pink", "rose"}),
    "yellow": frozenset({"yellow", "gold", "golden"}),
    "purple": frozenset({"purple", "violet", "lavender"}),
    "orange": frozenset({"orange"}),
}

_COLOR_OF = {}
for _name, _members in COLOR_GROUPS.items():
    for _m in _members:
        _COLOR_OF[_m] = _name


def color_of_word(word: str):
    """Return the colour group of one lowercase word (or its stem), else None.

    Time: O(L).
    """
    if word in _COLOR_OF:
        return _COLOR_OF[word]
    return _COLOR_OF.get(stem(word))


def color_group(text) -> "str | None":
    """Return the colour family of the first colour word in the text.

    "Navy blue" -> "blue", "Silver" -> "grey", "no colour here" -> None.
    Time: O(n) in the text length.
    """
    if not text:
        return None
    for word in _WORD_RE.findall(text.lower()):
        group = color_of_word(word)
        if group:
            return group
    return None


# --------------------------------------------------------------------------
# Sound-alike key
# --------------------------------------------------------------------------

_SOUND_REPLACEMENTS = [
    ("ph", "f"),
    ("ck", "k"),
    ("q", "k"),
    ("x", "ks"),
    ("z", "s"),
    ("w", "v"),
    ("ee", "i"),
    ("oo", "u"),
]
_SOUND_DROP = set("aeiouhy")


def sound_key(word: str) -> str:
    """Build a rough "sounds like" code so "fone" and "phone" look the same.

    Steps: lowercase, swap spellings that sound alike (ph->f, ck->k, q->k,
    x->ks, z->s, w->v, ee->i, oo->u), keep the first letter, drop vowels, h and
    y after it, then squash repeated letters. phone -> "fn", wallet -> "vlt".
    Time: O(L) in the word length.
    """
    w = (word or "").lower()
    for old, new in _SOUND_REPLACEMENTS:
        w = w.replace(old, new)
    if not w:
        return ""
    chars = [w[0]] + [c for c in w[1:] if c not in _SOUND_DROP]
    out = []
    for c in chars:
        if not out or out[-1] != c:
            out.append(c)
    return "".join(out)


# --------------------------------------------------------------------------
# Answers
# --------------------------------------------------------------------------

_PUNCT_RE = re.compile(r"[^\w\s]")
_SPACE_RE = re.compile(r"\s+")


def normalize_answer(s) -> str:
    """Lowercase, remove punctuation and squash spaces ("  Blue, Case! " -> "blue case").

    Used before comparing a claimant's answer with the finder's answer.
    Time: O(n).
    """
    s = (s or "").lower()
    s = _PUNCT_RE.sub(" ", s).replace("_", " ")
    return _SPACE_RE.sub(" ", s).strip()
