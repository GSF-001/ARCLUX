# Fixture for tests/python-e2e.test.ts (issue #429).
# Single-dot relative import: `from .repository import get_repo`.
from .repository import get_repo


def get_service() -> str:
    return get_repo()
