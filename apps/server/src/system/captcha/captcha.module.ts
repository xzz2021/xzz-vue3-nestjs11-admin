import { DynamicModule, Module } from "@nestjs/common";
import { CaptchaController } from "./captcha.controller.js";
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from "./captcha.module-definition.js";
import { CaptchaService } from "./captcha.service.js";

@Module({
  controllers: [CaptchaController],
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    return {
      // your custom logic here
      ...super.register(options),
    };
  }

  static registerAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    return {
      // your custom logic here
      ...super.registerAsync(options),
    };
  }
}
