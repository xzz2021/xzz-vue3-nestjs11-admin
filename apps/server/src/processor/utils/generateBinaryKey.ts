import { BadRequestException } from '@nestjs/common';

export function generateBinaryKey(roles: number[], maxBits = 32) {
  let binaryKey = 0; // 初始值为 0

  // 检查角色编号是否超出最大位数
  if (Math.max(...roles) > maxBits) {
    throw new BadRequestException(`角色编号不能大于最大位数 ${maxBits}`);
  }
  if (Math.min(...roles) < 1) {
    throw new BadRequestException('角色编号不能小于1');
  }

  // 遍历角色数组，将每个角色的对应二进制位“或”起来
  roles.forEach((role: number) => {
    // 每个角色的二进制位 = 2^(role - 1)
    binaryKey |= 1 << (role - 1); // 通过左移来设置对应的二进制位
  });

  // 将结果限制为 maxBits 位
  binaryKey &= (1 << maxBits) - 1; // 通过与操作掩码限制位数

  // 返回自定义长度的二进制字符串
  return binaryKey.toString(2).padStart(maxBits, '0'); // 补齐到最大位数
}
/**
 * 示例使用：
 * const roles = [3, 7, 12, 22, 26]; // 角色数组
 * const binaryKey = generateBinaryKey(roles, 32); // 设置为32位
 * console.log(binaryKey); // 输出32位二进制字符串
 */
