import { UserController } from "./user.controller";
import { UserService } from "./user.service";

export class AppModule {
  controllers = [UserController];
  providers = [UserService];
}
