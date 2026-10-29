"""
HTTP plumbing shared by every view: JSON errors, token auth, method routing and
request validation against openapi.yaml.
"""
import json
import logging
from functools import wraps

from django.http import JsonResponse, HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

log = logging.getLogger("api")


class ApiError(Exception):
    """Raise anywhere in a request to send a JSON error in the contract's Error shape."""

    def __init__(self, status, code, message, fields=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields


def error_response(status, code, message, fields=None, headers=None):
    payload = {"error": {"code": code, "message": message}}
    if fields:
        payload["error"]["fields"] = {str(k): str(v) for k, v in fields.items()}
    response = JsonResponse(payload, status=status)
    for key, value in (headers or {}).items():
        response[key] = value
    return response


def json_response(data, status=200):
    if status == 204:
        return HttpResponse(status=204)
    return JsonResponse(data, status=status, safe=False)


class JsonErrorMiddleware:
    """Turn ApiError and unexpected exceptions into JSON instead of Django's HTML pages."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exc):
        if isinstance(exc, ApiError):
            return error_response(exc.status, exc.code, exc.message, exc.fields)
        log.exception("Unhandled error on %s %s", request.method, request.path)
        return error_response(500, "server_error", "Something went wrong on the server. Try again in a moment.")


def handler404(request, exception=None):
    return error_response(404, "not_found", "There is nothing at this address.")


def handler500(request):
    return error_response(500, "server_error", "Something went wrong on the server. Try again in a moment.")


# ---- auth -------------------------------------------------------------------------------

def user_from_request(request):
    """Return the User for a valid `Authorization: Bearer <token>` header, else None."""
    if hasattr(request, "_findit_user"):
        return request._findit_user
    from .models import AuthToken

    user = None
    header = request.META.get("HTTP_AUTHORIZATION", "")
    parts = header.split()
    if len(parts) == 2 and parts[0].lower() == "bearer" and 0 < len(parts[1]) <= 128:
        token = (
            AuthToken.objects.select_related("user", "user__profile")
            .filter(key=parts[1], expires_at__gt=timezone.now())
            .first()
        )
        if token and token.user.is_active and hasattr(token.user, "profile"):
            user = token.user
    request._findit_user = user
    return user


def require_user(request):
    user = user_from_request(request)
    if user is None:
        raise ApiError(401, "unauthorized", "Log in to do this.")
    return user


def require_admin(request):
    user = require_user(request)
    if not user.profile.is_admin:
        raise ApiError(403, "forbidden", "Only the admin desk can do this.")
    return user


def uploaded_file(request, field):
    """Return an uploaded file from a multipart body, turning malformed bodies into a 400."""
    from django.http.multipartparser import MultiPartParserError

    content_type = request.META.get("CONTENT_TYPE", "")
    if not content_type.startswith("multipart/form-data"):
        raise ApiError(400, "invalid_upload", "Send the photo as multipart/form-data.")
    try:
        return request.FILES.get(field)
    except (MultiPartParserError, ValueError):
        raise ApiError(400, "invalid_upload", "The upload could not be read. Try choosing the photo again.")


def json_body(request):
    """Parse the request body as JSON. Invalid or missing JSON is a 400."""
    if not request.body:
        raise ApiError(400, "invalid_json", "Send the details as a JSON body.")
    try:
        return json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        raise ApiError(400, "invalid_json", "The request body is not valid JSON.")


# ---- routing ------------------------------------------------------------------------------

def route(**handlers):
    """
    Build one Django view for a URL that dispatches on HTTP method, e.g.
    `route(GET=list_items, POST=create_item)`. Other methods get a JSON 405.
    """
    allowed = sorted(handlers)

    @csrf_exempt
    def view(request, **kwargs):
        handler = handlers.get(request.method)
        if handler is None:
            return error_response(
                405, "method_not_allowed", f"{request.method} is not allowed here.", headers={"Allow": ", ".join(allowed)}
            )
        try:
            return handler(request, **kwargs)
        except ApiError as exc:
            return error_response(exc.status, exc.code, exc.message, exc.fields)

    return view


def operation(operation_id):
    """
    Decorate a spec view. Checks auth when the operation is secured, then validates and
    coerces path/query parameters and the JSON body against openapi.yaml. The handler is
    called as handler(request, user, params, body).
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(request, **kwargs):
            from .validators import spec_validator

            validator = spec_validator()
            op = validator.operation(operation_id)
            user = require_user(request) if op["secured"] else user_from_request(request)
            params = validator.parse_params(operation_id, kwargs, request.GET)
            body = None
            if op["body"] and "application/json" in op["body"].get("content", {}):
                body = validator.validate_body(operation_id, json_body(request))
            return fn(request, user, params, body)

        return wrapper

    return decorator
