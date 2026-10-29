"""
Top-level routes: the API under API_BASE_PATH, uploaded photos under /media/, and, when
frontend/dist exists (after `npm run build`), the React app on every other path so the
whole demo runs from one port.
"""
from django.conf import settings
from django.http import FileResponse
from django.urls import include, path, re_path
from django.views.static import serve

from api.http import error_response

handler404 = "api.http.handler404"
handler500 = "api.http.handler500"


def spa(request, *args, **kwargs):
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        return error_response(
            404, "not_found", "The web app is not built. Run `npm run build` in frontend/ or use the Vite dev server."
        )
    return FileResponse(open(index, "rb"), content_type="text/html")


def api_not_found(request, *args, **kwargs):
    return error_response(404, "not_found", "There is nothing at this address.")


base = settings.API_BASE_PATH
urlpatterns = [
    path(f"{base}/", include("api.urls")),
    re_path(rf"^{base}(/.*)?$", api_not_found),
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    re_path(r"^assets/(?P<path>.*)$", serve, {"document_root": settings.FRONTEND_DIST / "assets"}),
    re_path(r"^(?P<path>favicon\.svg|favicon\.ico|robots\.txt)$", serve, {"document_root": settings.FRONTEND_DIST}),
    re_path(r"^.*$", spa),
]
