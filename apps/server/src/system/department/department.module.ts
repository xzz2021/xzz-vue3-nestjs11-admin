import { OrganizationGenerationModule } from "@/processor/authorization/organization-generation.module.js";
import { Module } from "@nestjs/common";
import { DepartmentController } from "./department.controller.js";
import { DepartmentRepository } from "./department.repository.js";
import { DepartmentService } from "./department.service.js";

@Module({
  imports: [OrganizationGenerationModule],
  controllers: [DepartmentController],
  providers: [DepartmentService, DepartmentRepository],
  exports: [DepartmentService, DepartmentRepository],
})
export class DepartmentModule {}
