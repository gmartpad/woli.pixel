import { create } from "zustand";

export type BrandProfile = {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string | null;
  accentColor: string | null;
  neutralColor: string | null;
  forbiddenColors: string[] | null;
  tolerance: number;
  isDefault: boolean;
  notes: string | null;
};

type BrandState = {
  profiles: BrandProfile[];
  activeProfileId: string | null;

  setProfiles: (profiles: BrandProfile[]) => void;
  setActiveProfile: (id: string | null) => void;
  reset: () => void;
};

export const useBrandStore = create<BrandState>((set) => ({
  profiles: [],
  activeProfileId: null,

  setProfiles: (profiles) => {
    const defaultProfile = profiles.find((p) => p.isDefault);
    set({ profiles, activeProfileId: defaultProfile?.id || null });
  },
  setActiveProfile: (id) => set({ activeProfileId: id }),
  reset: () => set({ profiles: [], activeProfileId: null }),
}));
