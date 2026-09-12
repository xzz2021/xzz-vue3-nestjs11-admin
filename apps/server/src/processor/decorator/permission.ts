import { SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
export const PERMISSION_KEY = "permission";

// 用于全局  给被装饰的 函数 添加 元数据
export const RequiredPermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);

//  避免元数据覆写 收集 多个装饰器 的 权限
export const RequiredPermission2 = (key: string, permission: string) => {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const reflector = new Reflector();
    if (descriptor && descriptor.value) {
      const permissionList =
        reflector.get<string[]>(
          key,
          descriptor.value as (...args: any[]) => any,
        ) || [];
      SetMetadata(key, [...permissionList, permission])(
        target,
        propertyKey,
        descriptor,
      );
    } else {
      // 类装饰器上的权限数据
      const classPermission =
        reflector.get<string[]>(key, target as (...args: any[]) => any) || [];
      SetMetadata(key, [...classPermission, permission])(
        target as (...args: any[]) => any,
      );
    }
  };
};
