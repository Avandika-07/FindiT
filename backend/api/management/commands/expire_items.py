"""python manage.py expire_items — open found items older than ITEM_EXPIRY_DAYS become Expired."""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Item
from api.services.status import transition


class Command(BaseCommand):
    help = "Mark open found items older than ITEM_EXPIRY_DAYS as EXPIRED."

    def handle(self, *args, **opts):
        cutoff = timezone.now() - timedelta(days=settings.ITEM_EXPIRY_DAYS)
        stale = Item.objects.filter(type=Item.FOUND, status=Item.OPEN, created_at__lt=cutoff)
        count = 0
        for item in stale:
            transition(item, Item.EXPIRED, None, f"Unclaimed for {settings.ITEM_EXPIRY_DAYS} days")
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Expired {count} item(s)."))
