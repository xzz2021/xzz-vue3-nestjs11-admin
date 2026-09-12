import { UseInterceptors } from '@nestjs/common';
import { ClassConstructor } from 'class-transformer';
import { SerializeInterceptor } from '@/processor/interceptor/serialize.js';

// 序列化装饰器  简化代码
export function Serialize(dto: ClassConstructor<any>) {
  return UseInterceptors(new SerializeInterceptor(dto));
}

/*
使用示例  在控制器 controller 中使用

@Serialize(OutputDto)   //  传递出参dto
  @Get()
  @Serialize(OutputDto)
  async findAll() {
    return this.departmentService.findAll();
  }

*/
