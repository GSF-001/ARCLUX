import { listUsers } from "./userController";
import { listProducts } from "./productController";

export function startServer() {
  console.log(listUsers(1));
  console.log(listProducts(1));
}
