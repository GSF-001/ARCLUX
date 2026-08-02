"""Entry point — imports service, does NOT import utils.unused_helper."""

from service import create_user_profile, create_product_listing
from models import User, Product


def main():
    user = User("Ada", "Lovelace")
    product = Product("Widget", 9.99)
    print(create_user_profile(user))
    print(create_product_listing(product))


if __name__ == "__main__":
    main()
