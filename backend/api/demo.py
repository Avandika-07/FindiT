"""Demo accounts created by `manage.py seed_demo` (and listed on the login page in debug)."""
from django.conf import settings

DEMO_STUDENTS = [
    {"roll_no": "21CS001", "password": "student123", "display_name": "Priya Raman", "label": "Student", "email": "priya@findit.local"},
    {"roll_no": "21EC014", "password": "student123", "display_name": "Arjun Mehta", "label": "Student", "email": "arjun@findit.local"},
    {"roll_no": "22ME033", "password": "student123", "display_name": "Kavya Iyer", "label": "Student", "email": "kavya@findit.local"},
    {"roll_no": "21IT042", "password": "finder123", "display_name": "Rahul Nair", "label": "Finder", "email": "rahul@findit.local"},
]


def admin_account():
    return {
        "roll_no": "ADMIN001",
        "email": settings.SEED_ADMIN_EMAIL,
        "password": settings.SEED_ADMIN_PASSWORD,
        "display_name": "Admin Desk",
        "label": "Admin",
    }


def demo_logins():
    admin = admin_account()
    rows = [
        {"roll_no": s["roll_no"], "password": s["password"], "display_name": s["display_name"], "role": "STUDENT", "label": s["label"]}
        for s in DEMO_STUDENTS
    ]
    rows.append(
        {"roll_no": admin["email"], "password": admin["password"], "display_name": admin["display_name"], "role": "ADMIN", "label": "Admin"}
    )
    return rows
