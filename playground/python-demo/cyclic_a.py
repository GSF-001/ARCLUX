"""Deliberately circular with cyclic_b — should be flagged by
detectCircularDependency."""

from cyclic_b import helper_b


def helper_a():
    return helper_b()
