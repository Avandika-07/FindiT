"""Handwritten binary search over sorted lists (the `bisect` module is not used)."""


def lower_bound(arr, key) -> int:
    """Return the first index whose element is NOT less than key (len(arr) if none).

    Elements are compared with `<`, so tuples like (date, id) work too.
    Time: O(log n).
    """
    lo, hi = 0, len(arr)
    while lo < hi:
        mid = (lo + hi) // 2
        if arr[mid] < key:
            lo = mid + 1
        else:
            hi = mid
    return lo


def upper_bound(arr, key) -> int:
    """Return the first index whose element is greater than key (len(arr) if none).

    Time: O(log n).
    """
    lo, hi = 0, len(arr)
    while lo < hi:
        mid = (lo + hi) // 2
        if key < arr[mid]:
            hi = mid
        else:
            lo = mid + 1
    return lo


def range_slice(arr, lo_key, hi_key) -> list:
    """Return every element e with lo_key <= e <= hi_key from a sorted list.

    Time: O(log n + k) where k is the number of returned elements.
    """
    return arr[lower_bound(arr, lo_key):upper_bound(arr, hi_key)]
