import { FileCleanupModule } from "@/system/file-cleanup/file-cleanup.module.js";
import { SessionModule } from "@/system/session/session.module.js";
import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "./user-persistence.module.js";
import { UserController } from "./user.controller.js";
import { UserService } from "./user.service.js";

@Module({
  imports: [UserPersistenceModule, SessionModule, FileCleanupModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
