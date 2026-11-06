import type { UserRole } from './role';

export interface BorrowUser {
	id: string;
	email: string;
	name?: string;
	username?: string;
	role?: UserRole;
	roles?: string[];
	isAdmin?: boolean;
}
