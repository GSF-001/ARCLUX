"""Data models."""

class User:
    def __init__(self, first_name: str, last_name: str):
        self.first_name = first_name
        self.last_name = last_name


class Product:
    def __init__(self, name: str, price: float):
        self.name = name
        self.price = price
