import os
import sys

from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = "api"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        # Start the background AI reviewer only in the process that serves requests:
        # with the autoreloader that is the child (RUN_MAIN=true), never in migrate/seed/tests.
        if "runserver" in sys.argv and (os.environ.get("RUN_MAIN") == "true" or "--noreload" in sys.argv):
            from .services.ai import start_worker

            start_worker()
