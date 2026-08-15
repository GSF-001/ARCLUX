# Fixture for tests/python-e2e.test.ts (issue #429).
# Two-dot relative import: `from ..utils import helper` — one level up
# from pkg/ to the repo root, then utils.
from ..utils import helper


def get_repo() -> str:
    return helper()
