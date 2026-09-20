import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** 需要登录，但不校验具体权限码 */
export const IS_AUTHENTICATED_KEY = "isAuthenticated";
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_KEY, true);
