import { UserService } from "./user.service";

export class UserController {
  constructor(private service: UserService) {}

  create(name: string, password: string) {
    return this.service.createUser(name, password);
  }
}
