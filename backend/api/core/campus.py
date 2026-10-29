"""Campus map helpers: how many "hops" apart two places are."""

from collections import deque


def hop_distance(graph, a: int, b: int, max_depth: int = 3):
    """Return how many steps apart places a and b are on the campus map.

    Uses breadth-first search (visits neighbours ring by ring). Returns 0 when
    a == b, and None when b is unreachable or more than `max_depth` steps away.
    `graph` maps a place id to its neighbouring place ids (set or list).
    Time: O(V + E) in the worst case, usually far less because we stop at max_depth.
    """
    if a == b:
        return 0
    if max_depth <= 0:
        return None
    seen = {a}
    queue = deque([(a, 0)])
    while queue:
        node, depth = queue.popleft()
        if depth >= max_depth:
            continue
        for nxt in graph.get(node, ()) or ():
            if nxt in seen:
                continue
            if nxt == b:
                return depth + 1
            seen.add(nxt)
            queue.append((nxt, depth + 1))
    return None
