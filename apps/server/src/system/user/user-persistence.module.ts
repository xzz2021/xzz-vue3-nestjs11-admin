import { Module } from "@nestjs/common";

import { UserRepository } from "./user.repository.js";

@Module({
  providers: [UserRepository],
  exports: [UserRepository],
})
export class UserPersistenceModule {}
