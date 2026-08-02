import { hashPassword } from "./utils";

export class UserService {
  createUser(name: string, password: string) {
    return { name, password: hashPassword(password) };
  }
}
