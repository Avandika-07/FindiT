"""FindiT algorithm core.

Pure-Python, standard-library-only implementations of everything "smart" in
FindiT: tokenizing and stemming, synonyms and colours, sound-alike keys,
typo distance, trigram and trie indexes, binary search, campus graph BFS,
photo fingerprints (dHash), the BM25 search engine and the lost/found matcher.

This package must never import Django so it can be unit-tested and explained
on its own.
"""
