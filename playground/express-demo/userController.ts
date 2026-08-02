import { paginate } from "./utils";

export function listUsers(page: number) {
  const users = [{ id: 1, name: "Ada" }];
  return paginate(users, page, 10);
}
