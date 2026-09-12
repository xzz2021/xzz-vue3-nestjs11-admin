import { Module } from '@nestjs/common';
import { OrganizationGenerationService } from './organization-generation.service.js';

@Module({
  providers: [OrganizationGenerationService],
  exports: [OrganizationGenerationService],
})
export class OrganizationGenerationModule {}
