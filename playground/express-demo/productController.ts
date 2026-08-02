import { paginate } from "./utils";

export function listProducts(page: number) {
  const products = [{ id: 1, name: "Widget" }];
  return paginate(products, page, 10);
}
