"""Business logic — imports from both utils and models."""

from utils import format_name, slugify
from models import User, Product


def create_user_profile(user: User) -> dict:
    return {
        "name": format_name(user.first_name, user.last_name),
        "slug": slugify(user.first_name),
    }


def create_product_listing(product: Product) -> dict:
    return {"name": product.name, "price": product.price}
