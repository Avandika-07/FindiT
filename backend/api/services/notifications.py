"""In-app notifications, each with an e-mail copy through Django's mail backend."""
import logging
import threading
from contextlib import contextmanager
from html import escape

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from ..models import Claim, Item, Notification, Profile, User

log = logging.getLogger("api")

_muted = threading.local()

# Short call to action per notification kind, used as the e-mail button label.
ACTIONS = {
    "MATCH": "See the match",
    "CLAIM_NEW": "Review the claim",
    "CLAIM_VERIFIED": "Get your handover code",
    "CLAIM_REJECTED": "See your claims",
    "RETURNED": "Open FindiT",
    "SYSTEM": "Open FindiT",
}


@contextmanager
def emails_muted():
    """No e-mails inside this block (used while seeding demo data). In-app notifications still happen."""
    _muted.on = True
    try:
        yield
    finally:
        _muted.on = False


def notify(user, kind, title, body="", link=None):
    if user is None:
        return None
    n = Notification.objects.create(user=user, kind=kind, title=title[:120], body=body[:300], link=link)
    if not getattr(_muted, "on", False):
        send_email(user, kind, title, body, link)
    return n


def send_email(user, kind, title, body, link):
    """E-mail copy of a notification. Never raises: e-mail must not break the request."""
    redirect = settings.EMAIL_REDIRECT_TO
    if not (user.email or redirect):
        return
    name = getattr(getattr(user, "profile", None), "display_name", "") or user.first_name or user.username
    to = redirect or [user.email]
    url = f"{settings.APP_BASE_URL}{link or '/'}"
    action = ACTIONS.get(kind, "Open FindiT")
    note = f"Sent to this inbox for {name} <{user.email}>." if redirect else ""

    text = f"Hi {name},\n\n{title}\n{body}\n\n{action}: {url}\n" + (f"\n{note}\n" if note else "")
    html = f"""\
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18213f">
  <p style="margin:0 0 16px;font-size:20px;font-weight:bold;color:#2f5bea">FindiT</p>
  <p style="margin:0 0 8px">Hi {escape(name)},</p>
  <p style="margin:0 0 8px;font-size:18px;font-weight:bold">{escape(title)}</p>
  <p style="margin:0 0 20px;line-height:1.5">{escape(body)}</p>
  <a href="{escape(url)}" style="display:inline-block;background:#2f5bea;color:#ffffff;text-decoration:none;
     padding:12px 20px;border-radius:10px;font-weight:bold">{escape(action)}</a>
  <p style="margin:24px 0 0;font-size:12px;color:#4a5372">
    You get this because you use FindiT, the campus lost and found.{f"<br>{escape(note)}" if note else ""}
  </p>
</div>"""
    msg = EmailMultiAlternatives(f"FindiT: {title}", text, settings.DEFAULT_FROM_EMAIL, to)
    msg.attach_alternative(html, "text/html")

    def deliver():
        try:
            msg.send()
        except Exception as exc:
            log.warning("Could not send e-mail '%s' to %s: %s", title, ", ".join(to), exc)

    if settings.EMAIL_ASYNC:
        threading.Thread(target=deliver, daemon=True).start()
    else:
        deliver()


def notify_admins(kind, title, body="", link=None):
    for user in User.objects.filter(profile__role=Profile.ADMIN, is_active=True):
        notify(user, kind, title, body, link)


def on_transition(obj, from_status, to_status, actor, note):
    if isinstance(obj, Item):
        _item_changed(obj, to_status)
    elif isinstance(obj, Claim):
        _claim_changed(obj, to_status, note)


def _item_changed(item, to_status):
    link = f"/items/{item.id}"
    if to_status == Item.EXPIRED:
        notify(
            item.reporter,
            "SYSTEM",
            f"Your report expired: {item.title}",
            f"Nobody claimed it within {settings.ITEM_EXPIRY_DAYS} days. Hand it to the security desk if you still have it.",
            link,
        )


def _claim_changed(claim, to_status, note):
    item = claim.item
    if to_status == Claim.VERIFIED:
        notify(
            claim.claimant,
            "CLAIM_VERIFIED",
            f"Claim approved: {item.title}",
            f"Show your handover code at {item.location.name} to collect it.",
            "/me?tab=claims",
        )
    elif to_status == Claim.REJECTED:
        notify(
            claim.claimant,
            "CLAIM_REJECTED",
            f"Claim rejected: {item.title}",
            note or "The reviewer could not confirm you are the owner.",
            "/me?tab=claims",
        )
    elif to_status == Claim.HANDED_OVER:
        notify(
            claim.claimant,
            "RETURNED",
            f"Collected: {item.title}",
            "Glad it found its way back to you.",
            f"/items/{item.id}",
        )
        notify(
            item.reporter,
            "RETURNED",
            f"You returned {item.title}",
            f"You earned {settings.FINDER_KARMA_POINTS} karma points. Thank you for helping.",
            "/leaderboard",
        )
