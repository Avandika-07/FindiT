import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_wsgi_application()

from api.services.ai import start_worker  # noqa: E402  (needs Django set up first)

start_worker()
