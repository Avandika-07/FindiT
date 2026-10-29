from datetime import date

from api.core.matcher import MatchInput, duplicate_score, is_duplicate, score_pair


def lost_earphones(**kw):
    base = dict(category="Earphones", title="Navy boAt earphones",
                description="boAt Airdopes earphones in a navy case",
                color="Navy", brand="boAt", location_id=1, event_date=date(2026, 10, 5))
    base.update(kw)
    return MatchInput(**base)


def found_earphones(**kw):
    base = dict(category="Earphones", title="Blue earphones found",
                description="boat earphones case, blue colour",
                color="Blue", brand="Boat", location_id=2, event_date=date(2026, 10, 6))
    base.update(kw)
    return MatchInput(**base)


def test_breakdown_on_crafted_pair():
    r = score_pair(lost_earphones(), found_earphones(), hops=1)
    assert set(r.breakdown) == {"category", "text", "color", "brand", "location", "time"}
    assert r.breakdown["category"] == 25
    assert r.breakdown["color"] == 10
    assert r.breakdown["brand"] == 10
    assert r.breakdown["location"] == 10
    assert r.breakdown["time"] == 9
    assert 10 <= r.breakdown["text"] <= 30
    assert r.score == sum(r.breakdown.values())
    assert "Same category: Earphones" in r.reasons
    assert "Both blue" in r.reasons
    assert "Same brand: boAt" in r.reasons
    assert "Found 1 place away" in r.reasons
    assert "1 day apart" in r.reasons
    assert any(x.startswith("Descriptions share words like") and "earphones" in x for x in r.reasons)


def test_location_and_time_points():
    assert score_pair(lost_earphones(), found_earphones(), 0).breakdown["location"] == 15
    assert score_pair(lost_earphones(), found_earphones(), 2).breakdown["location"] == 5
    r = score_pair(lost_earphones(), found_earphones(), None)
    assert r.breakdown["location"] == 0
    assert not any(x.startswith("Found") for x in r.reasons)
    r = score_pair(lost_earphones(), found_earphones(event_date=date(2026, 10, 5)), 0)
    assert r.breakdown["time"] == 10 and "Same day" in r.reasons
    r = score_pair(lost_earphones(), found_earphones(event_date=date(2026, 10, 25)), 0)
    assert r.breakdown["time"] == 0


def test_date_rule():
    # found two days before it was lost -> impossible
    assert score_pair(lost_earphones(), found_earphones(event_date=date(2026, 10, 3)), 0) is None
    # one day before is tolerated (people misremember dates)
    assert score_pair(lost_earphones(), found_earphones(event_date=date(2026, 10, 4)), 0) is not None


def test_synonyms_raise_text_score():
    lost = MatchInput("Earphones", "earbuds", "white earbuds", None, None, 1, date(2026, 10, 5))
    same_words = MatchInput("Earphones", "earbuds", "white earbuds", None, None, 1, date(2026, 10, 5))
    synonym = MatchInput("Earphones", "airpods", "white headphones", None, None, 1, date(2026, 10, 5))
    unrelated = MatchInput("Earphones", "umbrella", "big umbrella", None, None, 1, date(2026, 10, 5))
    t_syn = score_pair(lost, synonym, 0).breakdown["text"]
    t_unrel = score_pair(lost, unrelated, 0).breakdown["text"]
    assert score_pair(lost, same_words, 0).breakdown["text"] == 30
    assert t_syn > 20
    assert t_unrel == 0


def test_idf_weighting():
    lost = MatchInput("Bag", "black bag", "black bag with laptop", None, None, 1, date(2026, 10, 5))
    found = MatchInput("Bag", "black umbrella", "black thing", None, None, 1, date(2026, 10, 5))
    plain = score_pair(lost, found, 0).breakdown["text"]
    # "black" is very common -> low idf -> shared word counts for less
    weighted = score_pair(lost, found, 0, idf=lambda t: 0.1 if t == "black" else 2.0).breakdown["text"]
    assert weighted < plain


def test_no_brand_or_color_when_missing():
    r = score_pair(lost_earphones(brand=None, color=None), found_earphones(), 0)
    assert r.breakdown["brand"] == 0 and r.breakdown["color"] == 0
    r = score_pair(lost_earphones(brand="Sony"), found_earphones(), 0)
    assert r.breakdown["brand"] == 0


def test_duplicate_score():
    a = lost_earphones()
    earlier = lost_earphones(event_date=date(2026, 10, 1))   # 4 days earlier
    assert score_pair(a, earlier, 0) is None                 # date rule applies here...
    s = duplicate_score(a, earlier, 0)                       # ...but not here
    assert isinstance(s, int)
    assert s == 25 + 30 + 10 + 10 + 15 + 6
    assert duplicate_score(a, a, 0) == 100
    assert duplicate_score(a, found_earphones(), 1) == score_pair(a, found_earphones(), 1).score


def test_is_duplicate():
    a = lost_earphones()
    assert is_duplicate(a, lost_earphones(event_date=date(2026, 10, 3)), 0)  # date rule ignored
    assert not is_duplicate(a, MatchInput("Wallet", "brown wallet", "leather", "brown", None,
                                          9, date(2026, 9, 1)), None)
