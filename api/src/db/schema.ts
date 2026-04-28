import {
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const yarn = pgTable('yarn', {
  id: serial('id').primaryKey(),
  brand: text('brand').notNull(),
  colorway: text('colorway').notNull(),
  weight: text('weight').notNull(),
  fiber: text('fiber'),
  yardage: integer('yardage'),
  skeins: numeric('skeins', { precision: 14, scale: 4 }).notNull(),
  colorCode: text('color_code'),
  photoUrl: text('photo_url'),
  notes: text('notes'),
  tags: text('tags').array(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const patterns = pgTable('patterns', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  designer: text('designer'),
  craftType: text('craft_type').notNull(),
  difficulty: text('difficulty'),
  yarnWeight: text('yarn_weight'),
  yardageNeeded: integer('yardage_needed'),
  sourceUrl: text('source_url'),
  pdfUrl: text('pdf_url'),
  notes: text('notes'),
  tags: text('tags').array(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  patternId: integer('pattern_id').references(() => patterns.id),
  title: text('title').notNull(),
  status: text('status').notNull(),
  startDate: date('start_date'),
  endDate: date('end_date'),
  notes: text('notes'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

/** Links a project to one or more yarns with quantity used */
export const projectYarn = pgTable('project_yarn', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),
  yarnId: integer('yarn_id').references(() => yarn.id),
  skeinsUsed: numeric('skeins_used', { precision: 14, scale: 4 }),
});
