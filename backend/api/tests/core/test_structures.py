from api.core.binsearch import lower_bound, range_slice, upper_bound
from api.core.campus import hop_distance
from api.core.distance import damerau_levenshtein, similarity_percent, typo_allowance
from api.core.trie import Trie
from api.core.trigram import TrigramIndex


# ---------------------------------------------------------------- distance

def test_damerau_basic_and_swaps():
    assert damerau_levenshtein("", "") == 0
    assert damerau_levenshtein("abc", "") == 3
    assert damerau_levenshtein("", "ab") == 2
    assert damerau_levenshtein("ab", "ba") == 1
    assert damerau_levenshtein("walelt", "wallet") == 1
    assert damerau_levenshtein("kitten", "sitting") == 3
    assert damerau_levenshtein("same", "same") == 0
    assert damerau_levenshtein("ca", "abc") == 3  # OSA (not unrestricted DL)


def test_similarity_percent():
    assert similarity_percent("", "") == 100
    assert similarity_percent("Blue Case!", "blue case") == 100
    assert similarity_percent("abcd", "abce") == 75
    assert similarity_percent("abc", "xyz") == 0
    assert similarity_percent("abc", "") == 0


def test_typo_allowance():
    assert typo_allowance("key") == 0
    assert typo_allowance("keys") == 1
    assert typo_allowance("abcdefg") == 1
    assert typo_allowance("abcdefgh") == 2


# ---------------------------------------------------------------- trie

def test_trie_ordering_and_limit():
    t = Trie()
    for w in ["phone", "photo", "phone", "pho", "phantom", "bag"]:
        t.insert(w)
    t.insert("photo", 3)
    assert t.starts_with("ph") == ["photo", "phone", "phantom", "pho"]
    assert t.starts_with("ph", limit=2) == ["photo", "phone"]
    assert t.starts_with("x") == []
    assert t.starts_with("") [0] == "photo"
    assert len(t) == 5
    assert "phone" in t and "ph" not in t


def test_trie_remove():
    t = Trie()
    t.insert("phone", 2)
    t.insert("phones")
    t.remove("phone")
    assert "phone" in t
    t.remove("phone")
    assert "phone" not in t
    assert t.starts_with("pho") == ["phones"]
    t.remove("phones")
    assert len(t) == 0 and t.starts_with("p") == []
    t.remove("nothing")  # safe


# ---------------------------------------------------------------- trigram

def test_trigram_candidates():
    idx = TrigramIndex()
    for w in ["wallet", "walnut", "water", "phone"]:
        idx.add(w)
    cands = idx.candidates("walet", min_jaccard=0.2)
    words = [w for w, _ in cands]
    assert words[0] == "wallet"
    assert "phone" not in words
    jac = [j for _, j in cands]
    assert jac == sorted(jac, reverse=True)
    assert "wallet" in idx
    idx.remove("wallet")
    assert "wallet" not in idx
    assert "wallet" not in [w for w, _ in idx.candidates("walet", 0.2)]
    assert TrigramIndex().candidates("abc") == []


def test_trigram_exact_word_is_one():
    idx = TrigramIndex()
    idx.add("key")
    assert idx.candidates("key") == [("key", 1.0)]


# ---------------------------------------------------------------- binsearch

def test_binsearch_edges():
    assert lower_bound([], 5) == 0 and upper_bound([], 5) == 0
    arr = [1, 2, 2, 2, 5, 7]
    assert lower_bound(arr, 2) == 1 and upper_bound(arr, 2) == 4
    assert lower_bound(arr, 0) == 0 and upper_bound(arr, 0) == 0     # all larger
    assert lower_bound(arr, 9) == 6 and upper_bound(arr, 9) == 6     # all smaller
    assert lower_bound(arr, 3) == 4 and upper_bound(arr, 3) == 4
    assert range_slice(arr, 2, 5) == [2, 2, 2, 5]
    assert range_slice(arr, 8, 9) == []
    assert range_slice([], 1, 2) == []


def test_binsearch_tuples():
    arr = [(1, 10), (2, 3), (2, 8), (4, 1)]
    assert range_slice(arr, (2,), (2, float("inf"))) == [(2, 3), (2, 8)]
    assert lower_bound(arr, (3,)) == 3


# ---------------------------------------------------------------- campus

def test_hop_distance():
    g = {1: {2}, 2: [1, 3], 3: {2, 4}, 4: {3, 5}, 5: {4}, 9: set()}
    assert hop_distance(g, 1, 1) == 0
    assert hop_distance(g, 1, 2) == 1
    assert hop_distance(g, 1, 3) == 2
    assert hop_distance(g, 1, 4) == 3
    assert hop_distance(g, 1, 5) is None            # 4 hops > max_depth 3
    assert hop_distance(g, 1, 5, max_depth=4) == 4
    assert hop_distance(g, 1, 9) is None            # unreachable
    assert hop_distance(g, 42, 1) is None           # unknown node
    assert hop_distance({}, 1, 1) == 0
