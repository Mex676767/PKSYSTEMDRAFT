export const PERMISSIONS = {
  manage_hall_of_fame: "Manage Guinness Records",
  manage_hof_awards: "Manage Hall of Fame",
  manage_quiz: "Manage Quiz Questions",
  manage_mentors: "Manage Mentors & Departments",
  manage_users: "Manage Users (deactivate accounts)",
  manage_bets: "Resolve Bets",
  manage_learning: "Manage Learning Hub",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];
