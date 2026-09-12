export interface MenuTreeDto {
  id: string;
  parentId: string | null;

  name: string;
  title: string;
  path: string;
  component?: string;

  checked: boolean;

  permissions: PermissionDto[];

  children: MenuTreeDto[];
}

export interface PermissionDto {
  id: string;

  code: string;

  name: string;

  checked: boolean;
}
