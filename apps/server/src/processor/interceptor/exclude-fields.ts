import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

//  学习  递归   遍历  灵活处理任意嵌套数据结构
@Injectable()
export class ExcludeFieldsInterceptor implements NestInterceptor {
  constructor(private readonly fieldsToExclude: string[]) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data: any) => this.excludeFields(data)));
  }

  private excludeFields(data: any): any {
    return this.process(data);
  }

  private process(value: any): any {
    // 基本类型：直接返回
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null ||
      value === undefined
    ) {
      return value;
    }

    // 数组：递归处理每一项
    if (Array.isArray(value)) {
      return value.map((item: any) => this.process(item));
    }

    //  后期可以优化 约定  数据库返回数据的key名   只对是数据库返回的数据进行处理  其余手动返回的直接跳过

    // 对象：过滤字段并递归处理每个属性
    if (typeof value === "object") {
      const result: any = {};
      for (const key of Object.keys(value as string)) {
        if (!this.fieldsToExclude.includes(key)) {
          result[key] = this.process(value[key]);
        }
      }
      return result;
    }

    // 其他类型（function, symbol, etc）：直接返回
    return value;
  }
}
