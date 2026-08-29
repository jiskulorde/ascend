// src/lib/shortlists/types.ts

export type ClientShortlist = {
  id: string;
  owner_id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
