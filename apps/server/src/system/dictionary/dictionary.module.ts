import { Module } from "@nestjs/common";
import { DictionaryController } from "./dictionary.controller.js";
import { DictionaryRepository } from "./dictionary.repository.js";
import { DictionaryService } from "./dictionary.service.js";

@Module({
  controllers: [DictionaryController],
  providers: [DictionaryService, DictionaryRepository],
})
export class DictionaryModule {}
