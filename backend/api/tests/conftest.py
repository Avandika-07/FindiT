import pytest


@pytest.fixture(autouse=True)
def _fresh_search_index(request, settings, tmp_path):
    """The search index is an in-memory singleton; start every DB test from an empty one."""
    if "django_db" not in request.keywords and "db" not in request.fixturenames:
        yield
        return
    from api.services import search

    settings.MEDIA_ROOT = tmp_path
    search._index = None
    yield
    search._index = None
