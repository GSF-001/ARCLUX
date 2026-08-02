"""Shared utility functions."""

def format_name(first: str, last: str) -> str:
    return f"{first} {last}"


def slugify(text: str) -> str:
    return text.lower().replace(" ", "-")


def unused_helper() -> None:
    """Never imported anywhere — should be flagged by detectUnusedExports."""
    pass
