import { create } from 'zustand';
import type { Team } from '../features/teams/api/teamsApi';
import {
  createTeam,
  fetchMyTeams,
  updateTeam,
  deleteTeam,
  removeMember,
  leaveTeam,
} from '../features/teams/api/teamsApi';

interface TeamsState {
  teams: Team[];
  activeTeamId: string | null;
  isLoading: boolean;

  setActiveTeamId: (id: string | null) => void;
  loadTeams: (userId: string) => Promise<void>;
  addTeam: (params: {
    ownerId: string;
    name: string;
    description: string;
    visibility: 'public' | 'private';
  }) => Promise<Team>;
  editTeam: (
    teamId: string,
    updates: Partial<Pick<Team, 'name' | 'description' | 'visibility'>>
  ) => Promise<void>;
  removeTeam: (teamId: string) => Promise<void>;
  kickMember: (teamId: string, memberUid: string) => Promise<void>;
  exitTeam: (teamId: string, userId: string) => Promise<void>;
}

export const useTeamsStore = create<TeamsState>((set, get) => ({
  teams: [],
  activeTeamId: null,
  isLoading: false,

  setActiveTeamId: (id) => set({ activeTeamId: id }),

  loadTeams: async (userId) => {
    set({ isLoading: true });
    try {
      const teams = await fetchMyTeams(userId);
      set({ teams });
    } finally {
      set({ isLoading: false });
    }
  },

  addTeam: async (params) => {
    const team = await createTeam(params);
    set(s => ({ teams: [team, ...s.teams] }));
    return team;
  },

  editTeam: async (teamId, updates) => {
    await updateTeam(teamId, updates);
    set(s => ({
      teams: s.teams.map(t =>
        t.id === teamId ? { ...t, ...updates } : t
      ),
    }));
  },

  removeTeam: async (teamId) => {
    await deleteTeam(teamId);
    set(s => ({
      teams: s.teams.filter(t => t.id !== teamId),
      activeTeamId: s.activeTeamId === teamId ? null : s.activeTeamId,
    }));
  },

  kickMember: async (teamId, memberUid) => {
    await removeMember(teamId, memberUid);
    set(s => ({
      teams: s.teams.map(t =>
        t.id === teamId
          ? { ...t, memberIds: t.memberIds.filter(m => m !== memberUid) }
          : t
      ),
    }));
  },

  exitTeam: async (teamId, userId) => {
    await leaveTeam(teamId, userId);
    set(s => ({
      teams: s.teams.filter(t => t.id !== teamId),
      activeTeamId: s.activeTeamId === teamId ? null : s.activeTeamId,
    }));
  },
}));
