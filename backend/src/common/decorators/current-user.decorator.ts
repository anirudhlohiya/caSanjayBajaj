import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  sub: string;
  type: 'user' | 'admin';
  email: string;
  role?: string;
  permissions?: string[];
  /** Token issue time (seconds), set by the JWT library. */
  iat?: number;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return request.user ?? ({} as AuthUser);
  },
);
