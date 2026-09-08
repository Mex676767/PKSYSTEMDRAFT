// Granular permission keys, matching the has_permission()/set_user_permissions()
// SQL functions. is_admin implies all of these automatically -- these are
// for granting one specific capability to a non-admin user.
export const PERMISSIONS = {
  manage_hall_of_fame: "Manage Hall of Fame",
  manage_quiz: "Manage Quiz Questions",
  manage_mentors: "Manage Mentors & Departments",
  manage_users: "Manage Users (deactivate accounts)",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];
