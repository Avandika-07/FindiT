"""
FindiT settings.

Every value comes from the environment (backend/.env) and has a safe default,
so the app runs with a completely blank .env. An empty string counts as "not set".
"""
import os
import re
import sys
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent

load_dotenv(BASE_DIR / ".env")


def env(name, default=""):
    value = os.environ.get(name, "")
    return value.strip() if value and value.strip() else default


def env_bool(name, default):
    value = env(name)
    if not value:
        return default
    return value.lower() in ("1", "true", "yes", "on")


def env_int(name, default):
    value = env(name)
    try:
        return int(value) if value else default
    except ValueError:
        return default


def env_list(name, default):
    value = env(name)
    return [part.strip() for part in value.split(",") if part.strip()] if value else default


_DEV_SECRET = "findit-dev-secret-key-change-me-in-production-8f3a1c"
SECRET_KEY = env("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    SECRET_KEY = _DEV_SECRET
    if "runserver" in sys.argv:  # say it once, when the server starts, not on every command
        print("[FindiT] DJANGO_SECRET_KEY is empty, using the built-in development key.")

DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", ["localhost", "127.0.0.1", "0.0.0.0", "*"])

# No django.contrib.auth/contenttypes: FindiT has its own User model (api.User) with integer
# ids, so every collection works the same on SQLite and MongoDB.
INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "corsheaders",
    "api",
]
AUTH_USER_MODEL = "api.User"

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "api.http.JsonErrorMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
APPEND_SLASH = False

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": False,
        "OPTIONS": {"context_processors": []},
    }
]

# Database: MongoDB when DATABASE_URI (e.g. mongodb://localhost:27017/) is set, otherwise
# DATABASE_URL, otherwise a local SQLite file. MONGODB_URI is accepted as another name.
# Tests stay on SQLite unless FINDIT_TEST_BACKEND=mongo (they then use a throwaway test_<db>).
_TESTING = "pytest" in sys.modules
MONGODB_URI = env("DATABASE_URI") or env("MONGODB_URI")
MONGODB_DB = env("MONGODB_DB", "findit")
USE_MONGO = bool(MONGODB_URI) and (not _TESTING or os.environ.get("FINDIT_TEST_BACKEND") == "mongo")

if USE_MONGO:
    DATABASES = {
        "default": {
            "ENGINE": "django_mongodb_backend",
            "HOST": MONGODB_URI,
            "NAME": MONGODB_DB,
            "OPTIONS": {"serverSelectionTimeoutMS": 15000},
        }
    }
    DEFAULT_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"
else:
    DATABASES = {
        "default": dj_database_url.parse(
            env("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'db.sqlite3').as_posix()}"),
            conn_max_age=0,
        )
    }
    DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
# Every FindiT model declares its own integer primary key (api.models.IntIdModel), so
# DEFAULT_AUTO_FIELD is never used by our tables and one migration set serves both databases.

LANGUAGE_CODE = "en-us"
TIME_ZONE = env("DJANGO_TIME_ZONE", "Asia/Kolkata")
USE_I18N = False
USE_TZ = True

STATIC_URL = "/static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(env("MEDIA_ROOT", str(BASE_DIR / "media")))
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", ["http://localhost:5173", "http://127.0.0.1:5173"]
)
CORS_ALLOW_HEADERS = ["authorization", "content-type", "accept"]

OPENAPI_PATH = REPO_ROOT / "openapi.yaml"


def _base_path_from_spec():
    """Read servers[0].url from openapi.yaml without a YAML parser dependency at import time."""
    try:
        text = OPENAPI_PATH.read_text(encoding="utf-8")
    except OSError:
        return "api"
    found = re.search(r"^servers:\s*\n\s*-\s*url:\s*['\"]?([^'\"\s]+)", text, re.MULTILINE)
    if not found:
        return "api"
    url = found.group(1)
    path = re.sub(r"^[a-z]+://[^/]+", "", url)
    return path.strip("/") or "api"


API_BASE_PATH = env("API_BASE_PATH", _base_path_from_spec()).strip("/")

# Business rules
MAX_UPLOAD_MB = env_int("MAX_UPLOAD_MB", 5)
AUTH_TOKEN_TTL_HOURS = env_int("AUTH_TOKEN_TTL_HOURS", 72)
MATCH_THRESHOLD = env_int("MATCH_THRESHOLD", 45)
MAX_PENDING_CLAIMS = env_int("MAX_PENDING_CLAIMS", 3)
ITEM_EXPIRY_DAYS = env_int("ITEM_EXPIRY_DAYS", 30)
HANDOVER_CODE_LENGTH = env_int("HANDOVER_CODE_LENGTH", 6)
FINDER_KARMA_POINTS = env_int("FINDER_KARMA_POINTS", 10)
HANDOVER_MAX_ATTEMPTS = 5

# AI match recommendation: a local Ollama model gives a second opinion on candidate matches
# found by the handwritten matcher. It never changes the matcher's score. AI_PROVIDER=off
# disables it. Off during tests unless FINDIT_TEST_AI=1.
AI_PROVIDER = env("AI_PROVIDER", "ollama").lower()
if _TESTING and os.environ.get("FINDIT_TEST_AI") != "1":
    AI_PROVIDER = "off"
AI_ENABLED = AI_PROVIDER == "ollama"
AI_BASE_URL = env("AI_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
AI_MODEL = env("AI_MODEL", "qwen2.5:3b")  # fits a 6 GB laptop GPU; run `ollama pull qwen2.5:3b` once
AI_TIMEOUT_SECONDS = env_int("AI_TIMEOUT_SECONDS", 120)
AI_REVIEWS_PER_ITEM = env_int("AI_REVIEWS_PER_ITEM", 3)  # strongest candidates per new item
SEED_ADMIN_EMAIL = env("SEED_ADMIN_EMAIL", "admin@findit.local")
SEED_ADMIN_PASSWORD = env("SEED_ADMIN_PASSWORD", "admin123")

DATA_UPLOAD_MAX_MEMORY_SIZE = (MAX_UPLOAD_MB + 1) * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = DATA_UPLOAD_MAX_MEMORY_SIZE

# E-mail: console backend unless a host is configured. Both the EMAIL_* names and the
# SMTP_* / MAIL_* names work (SMTP_SECURE=true means SSL on 465, false means STARTTLS).
EMAIL_HOST = env("EMAIL_HOST") or env("SMTP_HOST")
if not env_bool("SEND_EMAIL", True):
    EMAIL_HOST = ""
if EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_PORT = env_int("EMAIL_PORT", env_int("SMTP_PORT", 587))
    EMAIL_HOST_USER = env("EMAIL_HOST_USER") or env("SMTP_USER")
    EMAIL_HOST_PASSWORD = (env("EMAIL_HOST_PASSWORD") or env("SMTP_PASSWORD")).replace(" ", "")
    EMAIL_USE_SSL = env_bool("SMTP_SECURE", False)
    EMAIL_USE_TLS = not EMAIL_USE_SSL and env_bool("EMAIL_USE_TLS", True)
    EMAIL_TIMEOUT = 20
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
_from = env("DEFAULT_FROM_EMAIL") or env("MAIL_FROM") or env("SMTP_USER")
DEFAULT_FROM_EMAIL = (f"FindiT <{_from}>" if "<" not in _from else _from) if _from else "FindiT <noreply@findit.local>"
# When set, every e-mail goes to these inboxes instead of the user's own address (the demo
# accounts have made-up addresses). Each mail says who it was meant for.
EMAIL_REDIRECT_TO = env_list("MAIL_TO", [])
# Links in e-mails point here.
APP_BASE_URL = env("APP_BASE_URL", "http://localhost:5173").rstrip("/")
# Send in a background thread so requests never wait on the mail server (inline in tests).
EMAIL_ASYNC = not _TESTING

# Passwords: fast hasher in tests only
PASSWORD_HASHERS = ["django.contrib.auth.hashers.PBKDF2PasswordHasher"]
if "pytest" in sys.modules:
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
        "api": {"handlers": ["console"], "level": "INFO"},
    },
}
