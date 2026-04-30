/** Shared entity shapes for API and web. */

export type CraftType = 'knit' | 'crochet';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type ProjectStatus = 'wip' | 'finished' | 'frogged';

export interface Yarn {
  id: number;
  userId: string;
  brand: string;
  colorway: string;
  weight: string;
  fiber: string | null;
  yardage: number | null;
  skeins: string;
  colorCode: string | null;
  photoUrl: string | null;
  notes: string | null;
  tags: string[] | null;
  createdAt: Date | string;
}

export interface Pattern {
  id: number;
  userId: string;
  title: string;
  designer: string | null;
  craftType: CraftType;
  difficulty: Difficulty | null;
  yarnWeight: string | null;
  yardageNeeded: number | null;
  sourceUrl: string | null;
  pdfUrl: string | null;
  notes: string | null;
  tags: string[] | null;
  createdAt: Date | string;
}

export interface Project {
  id: number;
  userId: string;
  patternId: number | null;
  title: string;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  photoUrl: string | null;
  createdAt: Date | string;
}

export interface ProjectYarn {
  id: number;
  projectId: number | null;
  yarnId: number | null;
  skeinsUsed: string | null;
}

export interface ProjectDetailResponse {
  project: Project;
  pattern: Pattern | null;
  yarnLinks: ProjectYarnWithYarn[];
}

export interface ProjectYarnWithYarn extends ProjectYarn {
  yarn: Yarn | null;
}

/** Response from `GET /patterns/:id/yardage-check` */
export interface YardageCheckResult {
  patternId: number;
  needed: number | null;
  grossYardsInInventory: number;
  yardsCommittedToWip: number;
  availableYards: number;
  sufficient: boolean | null;
  /** true when some inventory rows have null `yardage` (excluded from sums) */
  hasYarnWithUnknownYardage: boolean;
}
