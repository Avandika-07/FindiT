"""python manage.py rebuild_index [--rematch] — rebuild the search index and optionally re-run matching."""
from django.core.management.base import BaseCommand

from api.models import Item
from api.services import matching, search


class Command(BaseCommand):
    help = "Rebuild the in-memory search index from the database (and optionally re-run matching)."

    def add_arguments(self, parser):
        parser.add_argument("--rematch", action="store_true", help="Also re-score every open item.")

    def handle(self, *args, rematch=False, **opts):
        index = search.rebuild()
        self.stdout.write(f"Indexed {index.n_docs} item(s).")
        if rematch:
            graph = matching.campus_graph()
            created = 0
            for item in Item.objects.filter(status__in=matching.MATCHABLE).select_related("location"):
                created += len(matching.run_matching(item, graph=graph, notify_owner=False))
            self.stdout.write(f"Created {created} new match(es).")
        self.stdout.write(self.style.SUCCESS("Done."))
