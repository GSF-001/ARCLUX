# Fixture for tests/python-e2e.test.ts (issue #429).
# Target of pkg/service.py's `from .repository import get_repo`.
def helper() -> str:
    return "help"
