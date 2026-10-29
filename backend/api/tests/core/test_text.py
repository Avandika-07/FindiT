from api.core.text import (
    COLOR_GROUPS,
    STOPWORDS,
    SYNONYM_GROUPS,
    canonical_token,
    color_group,
    normalize_answer,
    sound_key,
    stem,
    synonyms_of,
    tokenize,
)


def test_stem_examples():
    expected = {
        "phones": "phone", "earphones": "earphone", "glasses": "glass",
        "glass": "glass", "boxes": "box", "watches": "watch", "keys": "key",
        "bottles": "bottle", "batteries": "battery", "charging": "charg",
        "specs": "spec", "bus": "bus", "bag": "bag", "status": "status",
        "iris": "iris", "dishes": "dish", "buzzes": "buzz",
    }
    for word, stemmed in expected.items():
        assert stem(word) == stemmed, word


def test_stem_keeps_short_stems():
    assert stem("sing") == "sing"   # "s" would be too short
    assert stem("ties") == "ties"


def test_tokenize_drops_stopwords_and_stems():
    assert tokenize("My LOST Blue Earphones, near the Library!") == ["blue", "earphone", "library"]
    assert tokenize("keys keys") == ["key", "key"]
    assert tokenize("") == []
    assert "the" in STOPWORDS and "phone" not in STOPWORDS


def test_every_synonym_group_is_symmetric():
    assert len(SYNONYM_GROUPS) == 15
    for group in SYNONYM_GROUPS:
        for member in group:
            assert synonyms_of(member) >= group - {member}, member
            assert member not in synonyms_of(member)


def test_specific_synonyms():
    assert "phone" in synonyms_of("fone")
    assert "iphone" in synonyms_of("mobile")
    assert "airpod" in synonyms_of("earphone")
    assert "spectacle" in synonyms_of("spec")
    assert "glass" in synonyms_of(stem("goggles"))
    assert "calculator" in synonyms_of("calci")
    assert "wallet" in synonyms_of("purse")
    assert synonyms_of("umbrella") == frozenset()
    assert synonyms_of("zzz") == frozenset()


def test_canonical_token():
    assert canonical_token("earbud") == canonical_token("headphone") == canonical_token("earphone")
    assert canonical_token("fone") == canonical_token("phone")
    assert canonical_token("boat") == "boat"


def test_color_group():
    assert color_group("Navy blue") == "blue"
    assert color_group("silver") == "grey"
    assert color_group("Golden strap") == "yellow"
    assert color_group("no colour words") is None
    assert color_group(None) is None
    assert set(COLOR_GROUPS) == {"blue", "black", "white", "grey", "red", "green",
                                 "brown", "pink", "yellow", "purple", "orange"}


def test_sound_key():
    assert sound_key("phone") == "fn"
    assert sound_key("fone") == "fn"
    assert sound_key("earphone") == sound_key("earfone")
    assert sound_key("wallet") == sound_key("walelt")
    assert sound_key("library") == sound_key("libary")
    assert sound_key("") == ""


def test_normalize_answer():
    assert normalize_answer("  Blue,   Case!! ") == "blue case"
    assert normalize_answer(None) == ""
