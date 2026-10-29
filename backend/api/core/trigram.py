"""Trigram index: quickly find words that share many 3-letter chunks."""


def trigrams(word: str) -> set:
    """Split a padded word into its 3-letter chunks: "key" -> {"$$k", "$ke", "key", "ey$"}.

    Time: O(L).
    """
    padded = "$$" + word + "$"
    return {padded[i:i + 3] for i in range(len(padded) - 2)}


class TrigramIndex:
    """Maps each 3-letter chunk to the set of words containing it.

    Used to find spelling candidates for a typo without comparing against
    every word in the vocabulary.
    """

    def __init__(self):
        """Create an empty index. Time: O(1)."""
        self._by_gram = {}   # trigram -> set of words
        self._grams = {}     # word -> its trigram set

    def add(self, word: str) -> None:
        """Add a word (no-op if already present). Time: O(L)."""
        if not word or word in self._grams:
            return
        grams = trigrams(word)
        self._grams[word] = grams
        for g in grams:
            self._by_gram.setdefault(g, set()).add(word)

    def remove(self, word: str) -> None:
        """Remove a word if present. Time: O(L)."""
        grams = self._grams.pop(word, None)
        if grams is None:
            return
        for g in grams:
            bucket = self._by_gram.get(g)
            if bucket is not None:
                bucket.discard(word)
                if not bucket:
                    del self._by_gram[g]

    def __contains__(self, word) -> bool:
        """True if the word is in the index. Time: O(1)."""
        return word in self._grams

    def __len__(self) -> int:
        """Number of words stored. Time: O(1)."""
        return len(self._grams)

    def candidates(self, word: str, min_jaccard: float = 0.3) -> list:
        """Return (word, jaccard) pairs for indexed words similar to `word`.

        Jaccard = shared chunks / all distinct chunks of both words. Results
        with jaccard >= min_jaccard are sorted by jaccard (high first) then
        alphabetically.
        Time: O(sum of bucket sizes for the word's trigrams + R log R) for R results.
        """
        if not word:
            return []
        grams = trigrams(word)
        shared = {}
        for g in grams:
            for other in self._by_gram.get(g, ()):
                shared[other] = shared.get(other, 0) + 1
        out = []
        for other, common in shared.items():
            union = len(grams) + len(self._grams[other]) - common
            jac = common / union if union else 0.0
            if jac >= min_jaccard:
                out.append((other, jac))
        out.sort(key=lambda p: (-p[1], p[0]))
        return out
