# Fixture for tests/python-e2e.test.ts (issue #429).
# Import chain exercising all three Python relative-import forms:
#   app.py:            from pkg.service import get_service   (dotted absolute)
#   pkg/service.py:    from .repository import get_repo      (single-dot relative)
#   pkg/repository.py: from ..utils import helper            (two-dot relative, up one level)
from pkg.service import get_service


def main() -> str:
    return get_service()
