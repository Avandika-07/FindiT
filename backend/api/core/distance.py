"""Edit distance (with swaps) and percentage similarity, handwritten."""

from .text import normalize_answer


def damerau_levenshtein(a: str, b: str) -> int:
    """Count the fewest single-letter edits to turn a into b.

    Edits are insert, delete, replace, or swapping two neighbouring letters
    (so "walelt" -> "wallet" is 1). This is the "optimal string alignment"
    version of Damerau-Levenshtein, computed with dynamic programming.
    Time: O(len(a) * len(b)); memory O(len(a) * len(b)).
    """
    a = a or ""
    b = b or ""
    n, m = len(a), len(b)
    if n == 0:
        return m
    if m == 0:
        return n
    # d[i][j] = distance between a[:i] and b[:j]
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        d[i][0] = i
    for j in range(m + 1):
        d[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            best = d[i - 1][j] + 1          # delete
            if d[i][j - 1] + 1 < best:      # insert
                best = d[i][j - 1] + 1
            if d[i - 1][j - 1] + cost < best:  # replace / keep
                best = d[i - 1][j - 1] + cost
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                if d[i - 2][j - 2] + 1 < best:  # swap neighbours
                    best = d[i - 2][j - 2] + 1
            d[i][j] = best
    return d[n][m]


def similarity_percent(a: str, b: str) -> int:
    """How alike two answers are, from 0 (nothing alike) to 100 (identical).

    Both are normalised first (lowercase, no punctuation). Formula:
    100 * (1 - distance / longer_length), rounded and clamped to 0..100.
    Time: O(len(a) * len(b)).
    """
    na, nb = normalize_answer(a), normalize_answer(b)
    if not na and not nb:
        return 100
    max_len = max(len(na), len(nb))
    dist = damerau_levenshtein(na, nb)
    pct = round(100 * (1 - dist / max_len))
    return max(0, min(100, pct))


def typo_allowance(word: str) -> int:
    """How many typos we forgive in a word: 0 if under 4 letters, 1 up to 7, else 2.

    Time: O(1).
    """
    n = len(word or "")
    if n < 4:
        return 0
    if n < 8:
        return 1
    return 2
