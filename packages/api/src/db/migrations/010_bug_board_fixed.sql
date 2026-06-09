-- Fixed Bug Triage board — system-managed, not user-created
-- Uses constant IDs so code can reference them directly

-- Step 1: Create the fixed bug board and columns first
INSERT OR IGNORE INTO boards (id, name) VALUES ('bug-triage-board', 'Bug Triage');

INSERT OR IGNORE INTO columns (id, board_id, name, color, position) VALUES
  ('bug-col-new', 'bug-triage-board', 'New', '#3B82F6', 0),
  ('bug-col-triaging', 'bug-triage-board', 'Triaging', '#F59E0B', 1),
  ('bug-col-triaged', 'bug-triage-board', 'Triaged', '#8B5CF6', 2),
  ('bug-col-progress', 'bug-triage-board', 'In Progress', '#06B6D4', 3),
  ('bug-col-testing', 'bug-triage-board', 'Testing', '#EC4899', 4),
  ('bug-col-reopened', 'bug-triage-board', 'Reopened', '#EF4444', 5),
  ('bug-col-done', 'bug-triage-board', 'Done', '#10B981', 6);

-- Step 2: Migrate cards from old setup-created Bug Triage boards to fixed board
-- Move cards to the Triaged column by default (they can be re-sorted later)
UPDATE cards SET board_id = 'bug-triage-board', column_id = 'bug-col-triaged'
  WHERE board_id IN (SELECT id FROM boards WHERE name = 'Bug Triage' AND id != 'bug-triage-board');

-- Step 3: Delete old columns from setup-created bug boards
DELETE FROM columns WHERE board_id IN (SELECT id FROM boards WHERE name = 'Bug Triage' AND id != 'bug-triage-board');

-- Step 4: Delete old setup-created Bug Triage boards
DELETE FROM boards WHERE name = 'Bug Triage' AND id != 'bug-triage-board';
