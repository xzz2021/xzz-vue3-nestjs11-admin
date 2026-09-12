import { Module } from "@nestjs/common";
import { DictionaryService } from "./dictionary.service.js";
import { DictionaryController } from "./dictionary.controller.js";

@Module({
  controllers: [DictionaryController],
  providers: [DictionaryService],
})
export class DictionaryModule {}
