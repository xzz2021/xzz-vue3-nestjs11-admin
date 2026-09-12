import { BadRequestException } from "@nestjs/common";

export interface ParentLink {
  id: string;
  parentId: string | null;
}

/**
 * 校验将 nodeId 挂到 candidateParentId 后不会形成环。
 * links 必须包含当前树中所有相关节点。
 */
export function assertAcyclicParent(
  links: ParentLink[],
  nodeId: string,
  candidateParentId: string | null,
  entityName: string,
): void {
  if (candidateParentId === null) return;
  if (candidateParentId === nodeId) {
    throw new BadRequestException(`${entityName}不能设置为自己的父节点`);
  }

  const parentById = new Map(links.map((item) => [item.id, item.parentId]));
  if (!parentById.has(nodeId)) {
    throw new BadRequestException(`${entityName}不存在`);
  }
  if (!parentById.has(candidateParentId)) {
    throw new BadRequestException(`父级${entityName}不存在`);
  }

  const visited = new Set<string>();
  let currentId: string | null = candidateParentId;
  while (currentId !== null) {
    if (currentId === nodeId) {
      throw new BadRequestException(
        `不能将${entityName}移动到自己的后代节点下`,
      );
    }
    if (visited.has(currentId)) {
      throw new BadRequestException(`${entityName}树已存在环`);
    }
    visited.add(currentId);
    currentId = parentById.get(currentId) ?? null;
  }
}
