"""Prefix tree (trie) with word frequencies, for autocomplete."""


class _Node:
    """One letter position in the trie."""

    __slots__ = ("children", "count")

    def __init__(self):
        self.children = {}
        self.count = 0  # how many times the word ending here was inserted


class Trie:
    """Stores words letter by letter so all words with a prefix are found fast."""

    def __init__(self):
        """Create an empty trie. Time: O(1)."""
        self._root = _Node()
        self._size = 0

    def insert(self, word: str, count: int = 1) -> None:
        """Add a word, or raise its frequency by `count` if it is already there.

        Time: O(L) for a word of length L.
        """
        if not word or count <= 0:
            return
        node = self._root
        for ch in word:
            nxt = node.children.get(ch)
            if nxt is None:
                nxt = _Node()
                node.children[ch] = nxt
            node = nxt
        if node.count == 0:
            self._size += 1
        node.count += count

    def remove(self, word: str) -> None:
        """Lower a word's frequency by one; delete it (and empty branches) at zero.

        Time: O(L).
        """
        if not word:
            return
        path = [self._root]
        node = self._root
        for ch in word:
            node = node.children.get(ch)
            if node is None:
                return
            path.append(node)
        if node.count == 0:
            return
        node.count -= 1
        if node.count > 0:
            return
        self._size -= 1
        # prune nodes that no longer lead anywhere
        for i in range(len(word) - 1, -1, -1):
            child = path[i + 1]
            if child.count == 0 and not child.children:
                del path[i].children[word[i]]
            else:
                break

    def _find(self, prefix: str):
        """Walk to the node for `prefix`, or None. Time: O(P)."""
        node = self._root
        for ch in prefix:
            node = node.children.get(ch)
            if node is None:
                return None
        return node

    def __contains__(self, word) -> bool:
        """True if the word was inserted (and not fully removed). Time: O(L)."""
        if not isinstance(word, str) or not word:
            return False
        node = self._find(word)
        return node is not None and node.count > 0

    def __len__(self) -> int:
        """Number of distinct words stored. Time: O(1)."""
        return self._size

    def count(self, word: str) -> int:
        """Frequency of a word (0 if absent). Time: O(L)."""
        node = self._find(word) if word else None
        return node.count if node else 0

    def starts_with(self, prefix: str, limit: int = 10) -> list:
        """Return up to `limit` words beginning with `prefix`, most frequent first,
        ties broken alphabetically.

        Time: O(P + K log K) where K is the number of words under the prefix
        (we visit each one with a depth-first walk, then sort).
        """
        if limit <= 0 or prefix is None:
            return []
        start = self._find(prefix)
        if start is None:
            return []
        found = []
        stack = [(start, prefix)]
        while stack:
            node, word = stack.pop()
            if node.count > 0:
                found.append((word, node.count))
            for ch, child in node.children.items():
                stack.append((child, word + ch))
        found.sort(key=lambda p: (-p[1], p[0]))
        return [w for w, _ in found[:limit]]
