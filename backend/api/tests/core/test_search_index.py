from datetime import date, datetime, timedelta

from api.core.search_index import IndexedDoc, SearchFilters, SearchIndex

TODAY = date(2026, 10, 8)


def make_doc(doc_id, title, body="", type="LOST", category="Other", status="OPEN",
             location_id=1, event_date=TODAY, created_days_ago=0):
    return IndexedDoc(
        doc_id=doc_id, title=title, body=body, type=type, category=category,
        status=status, location_id=location_id, event_date=event_date,
        created_at=datetime(2026, 10, 8, 12, 0) - timedelta(days=created_days_ago),
    )


def build_index():
    idx = SearchIndex()
    idx.add(make_doc(1, "Navy boAt earphones", "Lost my earphones in the Central Library",
                     category="Earphones", location_id=3, event_date=date(2026, 10, 5)))
    idx.add(make_doc(2, "Casio calculator", "Scientific calculator left in exam hall",
                     category="Stationery", type="FOUND", location_id=4, event_date=date(2026, 10, 1)))
    idx.add(make_doc(3, "Brown leather wallet", "Has my id card inside",
                     category="Wallet", location_id=5, event_date=date(2026, 9, 20)))
    idx.add(make_doc(4, "Redmi phone", "Black phone with cracked screen",
                     category="Phone", type="FOUND", location_id=3, event_date=date(2026, 10, 7)))
    idx.add(make_doc(5, "Spectacles in a brown case", "Found near canteen",
                     category="Glasses", type="FOUND", location_id=6, event_date=date(2026, 10, 2)))
    idx.add(make_doc(6, "White AirPods case", "Apple airpods charging case",
                     category="Earphones", type="FOUND", location_id=2, event_date=date(2026, 10, 6)))
    idx.add(make_doc(7, "Steel water bottle", "Milton bottle, blue lid",
                     category="Bottle", location_id=1, event_date=date(2026, 9, 1), status="RETURNED"))
    return idx


def top(outcome):
    return outcome.hits[0].doc_id if outcome.hits else None


def test_empty_index_is_safe():
    idx = SearchIndex()
    out = idx.search("phone", today=TODAY)
    assert out.hits == [] and out.corrected_query is None
    assert idx.suggest("ph") == []
    assert idx.explain("phone")[0].step == "none"
    assert idx.doc_freq("phone") == 0
    assert idx.n_docs == 0 and 1 not in idx
    idx.remove(99)
    assert idx.search("", today=TODAY).hits == []


def test_bm25_title_beats_body():
    idx = SearchIndex()
    idx.add(make_doc(1, "Notes folder", "contains a charger and other stuff"))
    idx.add(make_doc(2, "Laptop charger", "black, dell"))
    idx.add(make_doc(3, "Pencil box", "nothing else"))
    out = idx.search("charger", today=TODAY)
    assert [h.doc_id for h in out.hits] == [2, 1]
    assert out.hits[0].reasons[0].method == "exact"


def test_more_query_words_rank_higher():
    idx = build_index()
    out = idx.search("brown wallet", today=TODAY)
    assert top(out) == 3
    ids = [h.doc_id for h in out.hits]
    assert 5 in ids  # matched "brown" only
    assert ids.index(3) < ids.index(5)


def test_full_pipeline_fuzzy_query():
    idx = build_index()
    out = idx.search("blu earfone libary", today=TODAY)
    assert out.corrected_query is None
    assert top(out) == 1
    methods = {r.query_term: r.method for r in out.hits[0].reasons}
    assert methods["blu"] == "prefix"
    assert methods["earfone"] == "sounds_like"
    assert methods["libary"] == "sounds_like"
    matched = {r.query_term: r.matched_term for r in out.hits[0].reasons}
    assert matched["earfone"] == "earphones"   # surface form shown


def test_specific_lookups():
    idx = build_index()
    assert top(idx.search("calci", today=TODAY)) == 2
    assert idx.search("calci", today=TODAY).hits[0].reasons[0].method == "synonym"
    assert top(idx.search("walelt", today=TODAY)) == 3
    assert top(idx.search("fone", today=TODAY)) == 4
    assert top(idx.search("specs", today=TODAY)) == 5
    assert top(idx.search("navy", today=TODAY)) == 1
    # synonyms across groups: "earbuds" finds earphones and airpods docs
    ids = {h.doc_id for h in idx.search("earbuds", today=TODAY).hits}
    assert {1, 6} <= ids


def test_typo_step():
    idx = build_index()
    out = idx.search("calculatr", today=TODAY)
    assert top(out) == 2


def test_did_you_mean():
    idx = build_index()
    # close enough to be caught by the pipeline itself
    assert top(idx.search("airpds", today=TODAY)) == 6
    # two edits away and sounds different -> needs the did-you-mean pass
    out = idx.search("eurpods", today=TODAY)
    assert out.corrected_query == "airpods"
    assert top(out) == 6
    # hopeless query
    out = idx.search("qqqqzzzz", today=TODAY)
    assert out.hits == [] and out.corrected_query is None


def test_filters():
    idx = build_index()
    assert {h.doc_id for h in idx.search("case", SearchFilters(type="FOUND"), TODAY).hits} == {5, 6}
    assert {h.doc_id for h in idx.search("case", SearchFilters(category="Glasses"), TODAY).hits} == {5}
    assert idx.search("bottle", SearchFilters(statuses={"OPEN"}), TODAY).hits == []
    assert top(idx.search("bottle", SearchFilters(statuses={"OPEN", "RETURNED"}), TODAY)) == 7
    assert {h.doc_id for h in idx.search("phone earphones", SearchFilters(location_id=3), TODAY).hits} == {1, 4}


def test_date_range_filter():
    idx = build_index()
    f = SearchFilters(date_from=date(2026, 10, 2), date_to=date(2026, 10, 6))
    ids = {h.doc_id for h in idx.search("case earphones calculator", f, TODAY).hits}
    assert ids == {1, 5, 6}
    f = SearchFilters(date_to=date(2026, 10, 1))
    assert {h.doc_id for h in idx.search("calculator wallet", f, TODAY).hits} == {2, 3}
    f = SearchFilters(date_from=date(2026, 10, 7))
    assert {h.doc_id for h in idx.search("phone wallet", f, TODAY).hits} == {4}


def test_recency_and_open_boost():
    idx = SearchIndex()
    idx.add(make_doc(1, "Red umbrella", created_days_ago=60))
    idx.add(make_doc(2, "Red umbrella", created_days_ago=0))
    idx.add(make_doc(3, "Red umbrella", created_days_ago=0, status="CLAIMED"))
    out = idx.search("umbrella", today=TODAY)
    assert [h.doc_id for h in out.hits] == [2, 3, 1]
    s = {h.doc_id: h.score for h in out.hits}
    assert abs(s[2] / s[1] - 1.1 * 1.05 / 1.05) < 1e-3
    assert abs(s[2] / s[3] - 1.05) < 1e-3


def test_upsert_remove_and_counts():
    idx = build_index()
    assert idx.n_docs == 7 and 4 in idx
    assert idx.doc_freq("phone") == 1
    assert idx.doc_freq("phones") == 1
    idx.add(make_doc(4, "Silver keys", "bunch of keys"))
    assert idx.n_docs == 7
    assert idx.doc_freq("phone") == 0
    assert top(idx.search("keys", today=TODAY)) == 4
    assert idx.search("redmi", today=TODAY).hits == []
    idx.remove(4)
    assert 4 not in idx and idx.search("keys", today=TODAY).hits == []
    idx.clear()
    assert idx.n_docs == 0


def test_color_group_token_indexed():
    idx = build_index()
    assert idx.doc_freq("blue") == 2      # navy earphones + blue lid bottle
    out = idx.search("blue", today=TODAY)
    assert {h.doc_id for h in out.hits} == {1, 7}


def test_suggest():
    idx = build_index()
    assert idx.suggest("earph") == ["earphones"]
    s = idx.suggest("ca")
    assert "case" in s and "calculator" in s
    assert s.index("case") < s.index("calculator")   # "case" is in 2 docs, calculator in 1
    assert idx.suggest("") == []
    assert len(idx.suggest("c", limit=2)) == 2


def test_explain():
    idx = build_index()
    ex = idx.explain("blu earfone wallet zzzzqqq")
    steps = [(e.token, e.step) for e in ex]
    assert steps == [("blu", "prefix"), ("earfone", "sounds_like"),
                     ("wallet", "exact"), ("zzzzqqq", "none")]
    assert ex[1].matched_terms == ["earphones"]
    assert ex[2].weight == 1.0 and ex[3].weight == 0.0
