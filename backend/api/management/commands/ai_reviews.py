"""
python manage.py ai_reviews [--queue-all] [--limit N] [--retry-failed]

Runs pending AI match reviews right now, one after another, and prints each verdict.
The server's background worker does the same thing automatically; this command is handy
for demos (warm up the reviews before presenting) and for checking the model works.
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from api.models import AIReview, Match
from api.services import ai


class Command(BaseCommand):
    help = "Run pending AI match reviews now (uses the local Ollama model)."

    def add_arguments(self, parser):
        parser.add_argument("--queue-all", action="store_true", help="Queue a review for every match that has none.")
        parser.add_argument("--retry-failed", action="store_true", help="Queue failed reviews again.")
        parser.add_argument("--limit", type=int, default=None, help="Stop after this many reviews.")

    def handle(self, *args, queue_all=False, retry_failed=False, limit=None, **opts):
        if not settings.AI_ENABLED:
            raise CommandError("AI reviews are off (AI_PROVIDER is not 'ollama').")
        info = ai.status()
        if not info["reachable"]:
            raise CommandError(f"Ollama is not reachable at {settings.AI_BASE_URL}. Start Ollama and try again.")
        if not info["model_installed"]:
            raise CommandError(f"Model {settings.AI_MODEL} is not installed. Run: ollama pull {settings.AI_MODEL}")
        if queue_all:
            for match in Match.objects.filter(ai_review__isnull=True):
                AIReview.objects.create(match=match)
        if retry_failed:
            for review in AIReview.objects.filter(status=AIReview.FAILED):
                ai.reset(review)
        pending = AIReview.objects.filter(status=AIReview.PENDING).count()
        self.stdout.write(f"{pending} review(s) waiting. Model: {settings.AI_MODEL}")
        count = 0
        while limit is None or count < limit:
            next_id = AIReview.objects.filter(status=AIReview.PENDING).order_by("created_at", "id").values_list("id", flat=True).first()
            if next_id is None:
                break
            review = ai.run_review(next_id)
            count += 1
            m = review.match
            label = f"{m.lost.title} vs {m.found.title} (matcher {m.score})"
            if review.status == AIReview.DONE:
                self.stdout.write(f"  {label}: AI {review.score}/100, {review.confidence}, {review.duration_ms / 1000:.0f}s")
            else:
                self.stdout.write(self.style.WARNING(f"  {label}: failed, {review.error}"))
        self.stdout.write(self.style.SUCCESS(f"Done: {count} review(s)."))
