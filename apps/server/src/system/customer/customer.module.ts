import { Module } from "@nestjs/common";
import { CustomerController } from "./customer.controller.js";
import { CustomerRepository } from "./customer.repository.js";
import { CustomerService } from "./customer.service.js";

@Module({
  controllers: [CustomerController],
  providers: [CustomerService, CustomerRepository],
  exports: [CustomerService, CustomerRepository],
})
export class CustomerModule {}
