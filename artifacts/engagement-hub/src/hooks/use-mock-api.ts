import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addDays, subDays, isSameDay } from 'date-fns';

export type Employee = {
  id: string;
  name: string;
  role: string;
  department: string;
  initials: string;
  color: string;
  points: number;
  wins: number;
  badges: string[];
};

export type Goal = {
  id: string;
  title: string;
  description: string;
  type: 'Small Goals' | 'Big Goals';
  deadline: string;
  progress: number;
  completed: boolean;
  ownerId: string;
};

export type Challenge = {
  id: string;
  name: string;
  level: 'Personal' | 'Team' | 'Department';
  sideA: string; // Employee ID or Team name
  sideB: string;
  metric: string;
  status: 'pending' | 'active' | 'completed';
  scoreA: number;
  scoreB: number;
  winner?: string;
  forfeit?: boolean;
  reward: number;
};

export type MentorPairing = {
  id: string;
  mentorId: string;
  menteeId: string;
  department: string;
  status: 'active' | 'graduated';
};

export type Birthday = {
  id: string;
  employeeId: string;
  date: string; // ISO date
};

export type LotteryEntry = {
  id: string;
  employeeId: string;
  entries: number;
  reason: string;
};

export type LotteryWinner = {
  id: string;
  employeeId: string;
  prize: string;
  date: string;
};

// --- Mock Data Store ---
const CURRENT_USER_ID = 'emp1';
const today = new Date();

let employeesData: Employee[] = [
  { id: 'emp1', name: 'Alex Rivera', role: 'Frontend Engineer', department: 'Engineering', initials: 'AR', color: 'bg-blue-500', points: 1250, wins: 4, badges: ['Fast Starter', 'Bug Smasher'] },
  { id: 'emp2', name: 'Sam Chen', role: 'Product Manager', department: 'Product', initials: 'SC', color: 'bg-purple-500', points: 2100, wins: 7, badges: ['Visionary', 'Team Player'] },
  { id: 'emp3', name: 'Jordan Lee', role: 'UX Designer', department: 'Design', initials: 'JL', color: 'bg-pink-500', points: 1800, wins: 5, badges: ['Pixel Perfect'] },
  { id: 'emp4', name: 'Casey Smith', role: 'Backend Engineer', department: 'Engineering', initials: 'CS', color: 'bg-emerald-500', points: 900, wins: 2, badges: [] },
  { id: 'emp5', name: 'Taylor Swift', role: 'Marketing Lead', department: 'Marketing', initials: 'TS', color: 'bg-amber-500', points: 3400, wins: 12, badges: ['Campaign Master', 'Social Butterfly'] },
];

let goalsData: Goal[] = [
  { id: 'g1', title: 'Ship Dashboard Redesign', description: 'Complete the frontend implementation for the new user dashboard.', type: 'Big Goals', deadline: addDays(today, 5).toISOString(), progress: 80, completed: false, ownerId: 'emp1' },
  { id: 'g2', title: 'Review 5 PRs', description: 'Help unblock the team by reviewing pending pull requests.', type: 'Small Goals', deadline: addDays(today, 1).toISOString(), progress: 60, completed: false, ownerId: 'emp1' },
  { id: 'g3', title: 'Update documentation', description: 'Write docs for the new API endpoints.', type: 'Small Goals', deadline: subDays(today, 1).toISOString(), progress: 100, completed: true, ownerId: 'emp1' },
];

let challengesData: Challenge[] = [
  { id: 'c1', name: 'Bug Squashing Spree', level: 'Department', sideA: 'Frontend', sideB: 'Backend', metric: 'Bugs Fixed', status: 'active', scoreA: 15, scoreB: 12, reward: 500 },
  { id: 'c2', name: 'Code Review Sprint', level: 'Personal', sideA: 'emp1', sideB: 'emp4', metric: 'PRs Reviewed', status: 'active', scoreA: 5, scoreB: 8, reward: 100 },
  { id: 'c3', name: 'Design System Migration', level: 'Team', sideA: 'Design', sideB: 'Product', metric: 'Components Migrated', status: 'completed', scoreA: 45, scoreB: 45, winner: 'Tie', reward: 300 },
];

let mentorsData: MentorPairing[] = [
  { id: 'm1', mentorId: 'emp2', menteeId: 'emp1', department: 'Engineering & Product', status: 'active' },
  { id: 'm2', mentorId: 'emp5', menteeId: 'emp3', department: 'Marketing & Design', status: 'active' },
  { id: 'm3', mentorId: 'emp4', menteeId: 'emp2', department: 'Cross-functional', status: 'graduated' },
];

let birthdaysData: Birthday[] = [
  { id: 'b1', employeeId: 'emp3', date: today.toISOString() }, // Today!
  { id: 'b2', employeeId: 'emp5', date: addDays(today, 3).toISOString() },
  { id: 'b3', employeeId: 'emp4', date: addDays(today, 10).toISOString() },
];

let lotteryEntriesData: LotteryEntry[] = [
  { id: 'le1', employeeId: 'emp1', entries: 5, reason: 'Completed all sprint goals early' },
  { id: 'le2', employeeId: 'emp2', entries: 12, reason: 'Q3 Product Launch Success' },
  { id: 'le3', employeeId: 'emp3', entries: 3, reason: 'Peer recognition award' },
];

let lotteryWinnersData: LotteryWinner[] = [
  { id: 'lw1', employeeId: 'emp5', prize: '$100 Gift Card', date: subDays(today, 7).toISOString() },
  { id: 'lw2', employeeId: 'emp2', prize: 'Extra PTO Day', date: subDays(today, 14).toISOString() },
];

// --- Mock API Hooks ---
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      await delay(200);
      return employeesData.find(e => e.id === CURRENT_USER_ID)!;
    }
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      await delay(300);
      return [...employeesData].sort((a, b) => b.points - a.points);
    }
  });
}

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      await delay(300);
      return goalsData.filter(g => g.ownerId === CURRENT_USER_ID);
    }
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<Goal> }) => {
      await delay(400);
      goalsData = goalsData.map(g => g.id === id ? { ...g, ...updates } : g);
      return goalsData.find(g => g.id === id)!;
    },
    onSuccess: (updatedGoal) => {
      queryClient.setQueryData(['goals'], (old: Goal[] | undefined) => 
        old ? old.map(g => g.id === updatedGoal.id ? updatedGoal : g) : old
      );
    }
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newGoal: Omit<Goal, 'id' | 'ownerId' | 'completed'>) => {
      await delay(400);
      const goal: Goal = {
        ...newGoal,
        id: `g${Date.now()}`,
        ownerId: CURRENT_USER_ID,
        completed: newGoal.progress >= 100,
      };
      goalsData = [...goalsData, goal];
      return goal;
    },
    onSuccess: (goal) => {
      queryClient.setQueryData(['goals'], (old: Goal[] | undefined) => old ? [...old, goal] : [goal]);
    }
  });
}

export function useChallenges() {
  return useQuery({
    queryKey: ['challenges'],
    queryFn: async () => {
      await delay(300);
      return [...challengesData];
    }
  });
}

export function useCreateChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newChallenge: Omit<Challenge, 'id' | 'status' | 'scoreA' | 'scoreB'>) => {
      await delay(400);
      const challenge: Challenge = {
        ...newChallenge,
        id: `c${Date.now()}`,
        status: 'pending',
        scoreA: 0,
        scoreB: 0,
      };
      challengesData = [...challengesData, challenge];
      return challenge;
    },
    onSuccess: (challenge) => {
      queryClient.setQueryData(['challenges'], (old: Challenge[] | undefined) => old ? [...old, challenge] : [challenge]);
    }
  });
}

export function useMentors() {
  return useQuery({
    queryKey: ['mentors'],
    queryFn: async () => {
      await delay(300);
      return mentorsData.map(m => ({
        ...m,
        mentor: employeesData.find(e => e.id === m.mentorId)!,
        mentee: employeesData.find(e => e.id === m.menteeId)!,
      }));
    }
  });
}

export function useBirthdays() {
  return useQuery({
    queryKey: ['birthdays'],
    queryFn: async () => {
      await delay(300);
      return birthdaysData.map(b => ({
        ...b,
        employee: employeesData.find(e => e.id === b.employeeId)!,
        isToday: isSameDay(new Date(b.date), today),
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
  });
}

export function useLotteryData() {
  return useQuery({
    queryKey: ['lottery'],
    queryFn: async () => {
      await delay(300);
      return {
        entries: lotteryEntriesData.map(e => ({ ...e, employee: employeesData.find(emp => emp.id === e.employeeId)! })),
        winners: lotteryWinnersData.map(w => ({ ...w, employee: employeesData.find(emp => emp.id === w.employeeId)! })),
      };
    }
  });
}

export function useRunLottery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await delay(1500); // Suspense for spin
      if (lotteryEntriesData.length === 0) throw new Error("No entries");
      
      // Weighted random choice
      const pool = lotteryEntriesData.flatMap(e => Array(e.entries).fill(e.employeeId));
      const winnerId = pool[Math.floor(Math.random() * pool.length)];
      const winnerEmp = employeesData.find(e => e.id === winnerId)!;
      
      const winner: LotteryWinner = {
        id: `lw${Date.now()}`,
        employeeId: winnerId,
        prize: 'Surprise Swag Box',
        date: new Date().toISOString(),
      };
      
      lotteryWinnersData = [winner, ...lotteryWinnersData];
      lotteryEntriesData = lotteryEntriesData.filter(e => e.employeeId !== winnerId); // Remove winner's entries
      
      return winnerEmp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lottery'] });
    }
  });
}