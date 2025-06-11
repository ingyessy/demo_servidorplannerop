import { Role } from '@prisma/client';

export class CurrentUserDto {
  userId: number;
  siteId: number;
  subsiteId: number;
  role: Role;
  isAdmin: boolean;
  isSupervisor: boolean;
  isSuperAdmin: boolean;
  isGH: boolean;
  username?: string;
  email?: string;
}