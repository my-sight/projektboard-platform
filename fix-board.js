// fix-board.js
// This script patches the Kanban board and admin code to persist card ordering,
// improve the user administration and add a back button. Run it from the
// project root with `node fix-board.js`.

const fs = require('fs');
const path = require('path');

/**
 * Read, patch and write a file. If no changes are needed the file is left
 * untouched. Throws if the file cannot be read or written.
 * @param {string} filePath Relative path to file to patch
 * @param {(source: string) => string} transform Function that returns the
 *        modified source. If it returns the identical string no write occurs.
 */
function patchFile(filePath, transform) {
  const abs = path.resolve(filePath);
  let source = fs.readFileSync(abs, 'utf8');
  const modified = transform(source);
  if (modified !== source) {
    fs.writeFileSync(abs, modified, 'utf8');
    console.log(`Patched ${filePath}`);
  } else {
    console.log(`No changes for ${filePath}`);
  }
}

// Helper used in multiple places to escape RegExp special characters.
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// -----------------------------------------------------------------------------
// Patch OriginalKanbanBoard.tsx
// -----------------------------------------------------------------------------
patchFile('src/components/kanban/OriginalKanbanBoard.tsx', (code) => {
  let out = code;

  // 1) Insert reindexByStage helper if missing.
  if (!out.includes('function reindexByStage')) {
    const stateAnchorRegex = /const\s*\[\s*users\s*,\s*setUsers[^\n]*\n/;
    out = out.replace(stateAnchorRegex, (match) => {
      return match +
        '\n  // Helper: assign order to cards within each stage\n' +
        '  function reindexByStage(cards) {\n' +
        '    const stageCounts = {};\n' +
        '    return cards.map((c) => {\n' +
        '      const stage = c["Board Stage"];\n' +
        '      stageCounts[stage] = (stageCounts[stage] || 0) + 1;\n' +
        '      return { ...c, order: stageCounts[stage] };\n' +
        '    });\n' +
        '  }\n\n';
    });
  }

  // 2) Replace onDragEnd implementation. We detect the start of the function and
  // replace until its closing brace using a regular expression.
  const onDragStart = 'const onDragEnd = (result: DropResult) =>';
  const onDragRegex = new RegExp(
    escapeRegExp(onDragStart) +
      '\\s*{[^}]*saveCards\\s*\\(\\)\\s*;\\s*\\}\s*;',
    's'
  );
  if (onDragRegex.test(out)) {
    out = out.replace(onDragRegex, () => {
      return (
        'const onDragEnd = (result: DropResult) => {\n' +
        '  const { destination, draggableId } = result as any;\n' +
        '  if (!destination) return;\n' +
        '\n' +
        '  // Determine the target stage and optional swimlane/responsible parts\n' +
        '  let targetStage = destination.droppableId;\n' +
        '  let newResp = null;\n' +
        '  let newLane = null;\n' +
        '  if (targetStage.includes(\'||\')) {\n' +
        '    const parts = targetStage.split(\'||\');\n' +
        '    targetStage = parts[0];\n' +
        '    if (viewMode === \"swim\") newResp = parts[1] || null;\n' +
        '    if (viewMode === \"lane\") newLane = parts[1] || null;\n' +
        '  }\n' +
        '\n' +
        '  // Find the dragged card\n' +
        '  const cards = [...rows];\n' +
        '  const fromIndex = cards.findIndex((c) => String(idFor(c)) === String(draggableId));\n' +
        '  if (fromIndex === -1) return;\n' +
        '  const moved = { ...cards[fromIndex] };\n' +
        '  cards.splice(fromIndex, 1);\n' +
        '\n' +
        '  // Update fields on the moved card\n' +
        '  moved[\"Board Stage\"] = targetStage;\n' +
        '  if (newResp !== null) moved[\"Verantwortlich\"] = newResp;\n' +
        '  if (newLane !== null) moved[\"Swimlane\"] = newLane;\n' +
        '\n' +
        '  // Function that checks membership of the same group (stage + swim/responsible)\n' +
        '  const inSameGroup = (c) => {\n' +
        '    const sameStage = String(inferStage(c)) === String(targetStage);\n' +
        '    const sameResp = newResp === null || (String(c[\"Verantwortlich\"] || \"\").trim() || \"—\") === newResp;\n' +
        '    const sameLane = newLane === null || (c[\"Swimlane\"] || (lanes[0] || \"Allgemein\")) === newLane;\n' +
        '    return sameStage && sameResp && sameLane;\n' +
        '  };\n' +
        '\n' +
        '  // Calculate the insertion index within the group\n' +
        '  const groupCards = cards.filter(inSameGroup);\n' +
        '  const insertIndexInGroup = Math.min(destination.index, groupCards.length);\n' +
        '\n' +
        '  let seen = 0;\n' +
        '  let globalInsertIndex = cards.length;\n' +
        '  for (let i = 0; i < cards.length; i++) {\n' +
        '    if (inSameGroup(cards[i])) {\n' +
        '      if (seen === insertIndexInGroup) { globalInsertIndex = i; break; }\n' +
        '      seen++;\n' +
        '    }\n' +
        '    if (i === cards.length - 1 && seen === insertIndexInGroup) { globalInsertIndex = i + 1; }\n' +
        '  }\n' +
        '\n' +
        '  cards.splice(globalInsertIndex, 0, moved);\n' +
        '  const reindexed = reindexByStage(cards);\n' +
        '  setRows(reindexed);\n' +
        '  saveCards();\n' +
        '};'
      );
    });
  }

  // 3) Ensure saveCards writes order and stage.
  out = out.replace(
    /const\s+cardsToSave\s*=\s*rows\.map\([^\)]*\)\s*;/,
    () => {
      return (
        'const cardsToSave = rows.map((card) => ({\n' +
        '      board_id: boardId,\n' +
        '      card_id: idFor(card),\n' +
        '      card_data: card,\n' +
        '      order: card.order ?? null,\n' +
        '      stage: card[\"Board Stage\"] ?? null,\n' +
        '      updated_at: new Date().toISOString()\n' +
        '    }));'
      );
    }
  );

  // 4) Sort loaded cards by stage and order.
  const loadCardsPattern = /const\s+loadCards\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\(data\s*&&\s*data\.length\s*>\s*0\)\s*\{[\s\S]*?const\s+loadedCards\s*=\s*data\.map\([^\)]*\);[\s\S]*?setRows\(loadedCards\);/;
  out = out.replace(loadCardsPattern, (segment) => {
    return segment.replace(/setRows\(loadedCards\);/, () => {
      return (
        '// Sort by stage and order before setting state\n' +
        '      loadedCards.sort((a, b) => {\n' +
        '        const pos = (name) => DEFAULT_COLS.findIndex((c) => c.name === name);\n' +
        '        if (a[\"Board Stage\"] !== b[\"Board Stage\"]) {\n' +
        '          return pos(a[\"Board Stage\"]) - pos(b[\"Board Stage\"]);\n' +
        '        }\n' +
        '        const ao = a.order ?? 1;\n' +
        '        const bo = b.order ?? 1;\n' +
        '        return ao - bo;\n' +
        '      });\n' +
        '      setRows(loadedCards);'
      );
    });
  });

  return out;
});

// -----------------------------------------------------------------------------
// Patch UserManagement.tsx
// -----------------------------------------------------------------------------
patchFile('src/components/admin/UserManagement.tsx', (code) => {
  let out = code;

  // 1) Import useRouter if not already imported
  if (!out.includes('useRouter()')) {
    out = out.replace(
      /import\s+\{([^}]*)\}\s+from\s+'@mui\/material';/, (match) => {
        return match + "\nimport { useRouter } from 'next/navigation';";
      }
    );
  }

  // 2) Add state for create-user dialog
  if (!out.includes('createUserDialogOpen')) {
    out = out.replace(
      /const\s*\[\s*message\s*,\s*setMessage[^\n]*\n/, (match) => {
        return (
          match +
          '  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);\n' +
          "  const [newUser, setNewUser] = useState({ full_name: '', email: '', department: '', password: '', role: 'user', is_active: true });\n"
        );
      }
    );
  }

  // 3) Append createUser function
  if (!out.includes('const createUser = async')) {
    out += '\n  // Create a new user with name, email, department and password\n' +
      '  const createUser = async () => {\n' +
      "    if (!newUser.email.trim() || !newUser.password.trim()) { setMessage('❌ Bitte E-Mail und Passwort eingeben'); return; }\n" +
      '    try {\n' +
      "      const { data, error } = await supabase.auth.signUp({ email: newUser.email.trim(), password: newUser.password.trim() });\n" +
      '      if (error) throw error;\n' +
      '      if (data.user?.id) {\n' +
      "        await supabase.from('profiles').insert({\n" +
      "          id: data.user.id,\n" +
      "          email: newUser.email.trim(),\n" +
      "          full_name: newUser.full_name.trim(),\n" +
      "          company: newUser.department.trim(),\n" +
      "          role: newUser.role,\n" +
      "          is_active: newUser.is_active\n" +
      '        });\n' +
      '      }\n' +
      "      setCreateUserDialogOpen(false);\n" +
      "      setNewUser({ full_name: '', email: '', department: '', password: '', role: 'user', is_active: true });\n" +
      "      setMessage('✅ Benutzer erfolgreich erstellt!');\n" +
      '      loadData();\n' +
      "      setTimeout(() => setMessage(''), 3000);\n" +
      '    } catch (err) {\n' +
      '      console.error(err);\n' +
      "      setMessage('❌ Fehler beim Erstellen des Benutzers');\n" +
      '    }\n' +
      '  };\n';
  }

  // 4) Add router declaration if missing
  if (!out.includes('const router = useRouter')) {
    out = out.replace(
      /export\s+default\s+function\s+UserManagement\(\)\s*\{/, (match) => {
        return match + '\n  const router = useRouter();';
      }
    );
  }

  // 5) Insert buttons for creating user and back navigation
  if (!out.includes('👤 Neuer Benutzer')) {
    out = out.replace(
      /(<Button[^>]*>\s*➕\s*Neues\s*Team[^<]*<\/Button>)/,
      (m) => {
        return (
          m +
          '\n          <Button variant="outlined" onClick={() => setCreateUserDialogOpen(true)} sx={{ ml: 2 }}>👤 Neuer Benutzer</Button>' +
          '\n          <Button variant="outlined" onClick={() => router.push(\'/\')} sx={{ ml: 2 }}>⬅ Zurück</Button>'
        );
      }
    );
  }

  // 6) Show company/department column if not present
  if (!out.includes('{userProfile.company')) {
    // Add header cell
    out = out.replace(/Benutzer\s*<\/TableCell>\s*\n\s*<TableCell>\s*E-Mail/, (match) => {
      return match.replace('E-Mail', 'Abteilung</TableCell>\n                  <TableCell>E-Mail');
    });
    // Add data cell
    out = out.replace(/\{userProfile\.email\}/, (m) => {
      return '{userProfile.company || \'-\'} </TableCell>\n                  <TableCell>' + m;
    });
  }

  // 7) Insert user creation dialog
  if (!out.includes('<Dialog open={createUserDialogOpen}')) {
    out = out.replace(/return \(/, (match) => {
      return match + '\n      <>\n';
    });
    out = out.replace(/\n\s*\);\s*$/, () => {
      return (
        '\n        {/* Create User Dialog */}\n' +
        '        <Dialog open={createUserDialogOpen} onClose={() => setCreateUserDialogOpen(false)} maxWidth="sm" fullWidth>\n' +
        '          <DialogTitle>👤 Neuen Benutzer erstellen</DialogTitle>\n' +
        '          <DialogContent>\n' +
        '            <TextField label="Name" fullWidth margin="normal" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} />\n' +
        '            <TextField label="E-Mail" type="email" fullWidth margin="normal" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />\n' +
        '            <TextField label="Abteilungskürzel" fullWidth margin="normal" value={newUser.department} onChange={(e) => setNewUser({ ...newUser, department: e.target.value })} />\n' +
        '            <TextField label="Passwort" type="password" fullWidth margin="normal" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />\n' +
        '          </DialogContent>\n' +
        '          <DialogActions>\n' +
        '            <Button onClick={() => setCreateUserDialogOpen(false)}>Abbrechen</Button>\n' +
        '            <Button variant="contained" onClick={createUser}>Erstellen</Button>\n' +
        '          </DialogActions>\n' +
        '        </Dialog>\n' +
        '      </>\n      );';
      });
  }

  return out;
});

console.log('✅ Patch script completed.');