"""
URL map. Spec paths are written exactly as in openapi.yaml (no trailing slashes).
Path parameters are captured as strings so the spec validator can answer bad values
with a clear 400 instead of a bare 404. Extras live under ext/.
"""
from django.urls import path

from . import views as v
from . import views_ext as x
from .http import route

spec_patterns = [
    path("health", route(GET=v.get_health)),
    path("locations", route(GET=v.list_locations)),
    path("items", route(GET=v.list_items, POST=v.create_item)),
    path("items/<str:itemId>", route(GET=v.get_item, PATCH=v.update_item, DELETE=v.delete_item)),
    path("items/<str:itemId>/photo", route(POST=v.upload_item_photo)),
    path("items/<str:itemId>/matches", route(GET=v.list_item_matches)),
    path("items/<str:itemId>/claims", route(GET=v.list_item_claims, POST=v.create_claim)),
    path("search", route(GET=v.search_items)),
    path("claims/<str:claimId>", route(GET=v.get_claim)),
    path("claims/<str:claimId>/verify", route(POST=v.verify_claim)),
    path("claims/<str:claimId>/reject", route(POST=v.reject_claim)),
    path("claims/<str:claimId>/handover", route(POST=v.complete_handover)),
]

ext_patterns = [
    path("ext/auth/login", route(POST=x.login)),
    path("ext/auth/logout", route(POST=x.logout)),
    path("ext/auth/me", route(GET=x.me)),
    path("ext/auth/demo-users", route(GET=x.demo_users)),
    path("ext/meta", route(GET=x.meta)),
    path("ext/stats", route(GET=x.public_stats)),
    path("ext/leaderboard", route(GET=x.leaderboard)),
    path("ext/items/check-duplicates", route(POST=x.check_duplicates)),
    path("ext/items/<int:item_id>/timeline", route(GET=x.item_timeline)),
    path("ext/items/<int:item_id>/rematch", route(POST=x.rematch)),
    path("ext/items/<int:item_id>/ai-reviews", route(GET=x.item_ai_reviews)),
    path("ext/matches/<int:match_id>/ai-review", route(POST=x.rerun_ai_review)),
    path("ext/ai/status", route(GET=x.ai_status)),
    path("ext/me/items", route(GET=x.my_items)),
    path("ext/me/claims", route(GET=x.my_claims)),
    path("ext/claims/<int:claim_id>/proof-photo", route(POST=x.claim_proof_photo)),
    path("ext/claims/<int:claim_id>/timeline", route(GET=x.claim_timeline)),
    path("ext/search/suggest", route(GET=x.search_suggest)),
    path("ext/search/explain", route(GET=x.search_explain)),
    path("ext/notifications", route(GET=x.notifications)),
    path("ext/notifications/read-all", route(POST=x.notifications_read_all)),
    path("ext/notifications/<int:notification_id>/read", route(POST=x.notification_read)),
    path("ext/admin/queue", route(GET=x.admin_queue)),
    path("ext/admin/verified", route(GET=x.admin_verified)),
    path("ext/admin/stats", route(GET=x.admin_stats)),
    path("ext/admin/hotspots", route(GET=x.admin_hotspots)),
    path("ext/admin/flagged", route(GET=x.admin_flagged)),
    path("ext/admin/expired", route(GET=x.admin_expired)),
]

urlpatterns = spec_patterns + ext_patterns
