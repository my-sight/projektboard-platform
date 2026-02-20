'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Chip,
  Divider,
  Tabs,
  Tab,
  Paper,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';

interface BoardConfigProps {
  boardId: string;
  cols: any[];
  setCols: (cols: any[]) => void;
  lanes: string[];
  setLanes: (lanes: string[]) => void;
  responsibles: string[];
  setResponsibles: (responsibles: string[]) => void;
  checklists: any;
  setChecklists: (checklists: any) => void;
}

export default function BoardConfig({ 
  boardId, 
  cols, 
  setCols, 
  lanes, 
  setLanes, 
  responsibles, 
  setResponsibles,
  checklists,
  setChecklists
}: BoardConfigProps) {
  const [configTab, setConfigTab] = useState(0);
  const [newColumnName, setNewColumnName] = useState('');
  const [newLane, setNewLane] = useState('');
  const [newResponsible, setNewResponsible] = useState('');
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [boardSettings, setBoardSettings] = useState({
    name: `Board ${boardId}`,
    description: '',
    dragDropEnabled: true,
    autoArchive: true,
    emailNotifications: false,
    wipLimitsEnabled: true,
    colorCoding: true
  });

  // Spalte hinzufügen
  const addColumn = () => {
    if (newColumnName.trim()) {
      const newCol = {
        id: `col-${Date.now()}`,
        name: newColumnName.trim(),
        done: false,
        wip: null,
        color: '#2196f3'
      };
      setCols([...cols, newCol]);
      setNewColumnName('');
    }
  };

  // Spalte löschen
  const deleteColumn = (colId: string) => {
    if (window.confirm('Spalte wirklich löschen? Alle Karten in dieser Spalte werden in "Backlog" verschoben.')) {
      setCols(cols.filter(c => c.id !== colId));
    }
  };

  // Spalte als "Done" markieren
  const toggleColumnDone = (colId: string) => {
    setCols(cols.map(c => 
      c.id === colId ? { ...c, done: !c.done } : c
    ));
  };

  // WIP-Limit setzen
  const setWipLimit = (colId: string, limit: number | null) => {
    setCols(cols.map(c => 
      c.id === colId ? { ...c, wip: limit } : c
    ));
  };

  // Spalten-Reihenfolge ändern
  const moveColumn = (fromIndex: number, toIndex: number) => {
    const newCols = [...cols];
    const [moved] = newCols.splice(fromIndex, 1);
    newCols.splice(toIndex, 0, moved);
    setCols(newCols);
  };

  // Lane hinzufügen
  const addLane = () => {
    if (newLane.trim() && !lanes.includes(newLane.trim())) {
      setLanes([...lanes, newLane.trim()]);
      setNewLane('');
    }
  };

  // Lane löschen
  const deleteLane = (lane: string) => {
    if (window.confirm('Swimlane wirklich löschen? Alle Karten in dieser Lane werden in die Standard-Lane verschoben.')) {
      setLanes(lanes.filter(l => l !== lane));
    }
  };

  // Verantwortlichen hinzufügen
  const addResponsible = () => {
    if (newResponsible.trim() && !responsibles.includes(newResponsible.trim())) {
      setResponsibles([...responsibles, newResponsible.trim()]);
      setNewResponsible('');
    }
  };

  // Verantwortlichen löschen
  const deleteResponsible = (resp: string) => {
    if (window.confirm('Verantwortlichen wirklich löschen?')) {
      setResponsibles(responsibles.filter(r => r !== resp));
    }
  };

  // Checklisten-Item hinzufügen
  const addChecklistItem = () => {
    if (selectedColumn && newChecklistItem.trim()) {
      const newChecklists = { ...checklists };
      if (!newChecklists[selectedColumn]) {
        newChecklists[selectedColumn] = [];
      }
      newChecklists[selectedColumn].push(newChecklistItem.trim());
      setChecklists(newChecklists);
      setNewChecklistItem('');
    }
  };

  // Checklisten-Item löschen
  const deleteChecklistItem = (column: string, index: number) => {
    const newChecklists = { ...checklists };
    if (newChecklists[column]) {
      newChecklists[column].splice(index, 1);
      setChecklists(newChecklists);
    }
  };

  // Konfiguration exportieren
  const exportConfig = () => {
    const config = {
      boardId,
      settings: boardSettings,
      columns: cols,
      lanes,
      responsibles,
      checklists,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `board-config-${boardId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Konfiguration importieren
  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target?.result as string);
          if (config.columns) setCols(config.columns);
          if (config.lanes) setLanes(config.lanes);
          if (config.responsibles) setResponsibles(config.responsibles);
          if (config.checklists) setChecklists(config.checklists);
          if (config.settings) setBoardSettings(config.settings);
          alert('Konfiguration erfolgreich importiert!');
        } catch (error) {
          alert('Fehler beim Importieren der Konfiguration!');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Board-Konfiguration
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={exportConfig}>
            📥 Export
          </Button>
          <Button variant="outlined" component="label">
            📤 Import
            <input
              type="file"
              accept=".json"
              hidden
              onChange={importConfig}
            />
          </Button>
        </Box>
      </Box>

      <Tabs value={configTab} onChange={(e, v) => setConfigTab(v)} sx={{ mb: 3 }}>
        <Tab label="Spalten" />
        <Tab label="Swimlanes" />
        <Tab label="Team" />
        <Tab label="Checklisten" />
        <Tab label="Allgemein" />
      </Tabs>

      {/* Tab 0: Spalten */}
      {configTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Neue Spalte hinzufügen
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Spaltenname"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addColumn()}
                  />
                  <Button variant="contained" onClick={addColumn}>
                    Hinzufügen
                  </Button>
                </Box>
                
                <Alert severity="info" sx={{ mt: 2 }}>
                  Tipp: Markiere Spalten als "Done" um abgeschlossene Aufgaben zu kennzeichnen.
                </Alert>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Aktuelle Spalten ({cols.length})
                </Typography>
                <List>
                  {cols.map((col, index) => (
                    <ListItem key={col.id} divider>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {col.name}
                            </Typography>
                            {col.done && <Chip label="Done" color="success" size="small" />}
                            {col.wip && <Chip label={`WIP: ${col.wip}`} color="warning" size="small" />}
                          </Box>
                        }
                        secondary={`Position: ${index + 1} | ID: ${col.id}`}
                      />
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <TextField
                            size="small"
                            type="number"
                            label="WIP-Limit"
                            value={col.wip || ''}
                            onChange={(e) => setWipLimit(col.id, e.target.value ? parseInt(e.target.value) : null)}
                            sx={{ width: 100 }}
                            inputProps={{ min: 1, max: 99 }}
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={col.done}
                                onChange={() => toggleColumnDone(col.id)}
                              />
                            }
                            label="Done"
                          />
                          <IconButton 
                            onClick={() => index > 0 && moveColumn(index, index - 1)}
                            disabled={index === 0}
                            title="Nach links"
                          >
                            ⬅️
                          </IconButton>
                          <IconButton 
                            onClick={() => index < cols.length - 1 && moveColumn(index, index + 1)}
                            disabled={index === cols.length - 1}
                            title="Nach rechts"
                          >
                            ➡️
                          </IconButton>
                          <IconButton 
                            color="error" 
                            onClick={() => deleteColumn(col.id)}
                            disabled={cols.length <= 1}
                            title="Löschen"
                          >
                            🗑️
                          </IconButton>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 1: Swimlanes */}
      {configTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Neue Swimlane hinzufügen
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Swimlane-Name"
                    value={newLane}
                    onChange={(e) => setNewLane(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addLane()}
                  />
                  <Button variant="contained" onClick={addLane}>
                    Hinzufügen
                  </Button>
                </Box>
                
                <Alert severity="info" sx={{ mt: 2 }}>
                  Swimlanes helfen dabei, Karten nach Kategorien, Teams oder Prioritäten zu gruppieren.
                </Alert>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Aktuelle Swimlanes ({lanes.length})
                </Typography>
                <List>
                  {lanes.map((lane, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={lane}
                        secondary={`Position: ${index + 1}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton color="error" onClick={() => deleteLane(lane)}>
                          🗑️
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
                
                {lanes.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    Keine Swimlanes konfiguriert. Füge welche hinzu, um dein Board zu strukturieren.
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 2: Team */}
      {configTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Neuen Verantwortlichen hinzufügen
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Name"
                    value={newResponsible}
                    onChange={(e) => setNewResponsible(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addResponsible()}
                  />
                  <Button variant="contained" onClick={addResponsible}>
                    Hinzufügen
                  </Button>
                </Box>
                
                <Alert severity="info" sx={{ mt: 2 }}>
                  Team-Mitglieder können Karten zugewiesen werden und erscheinen in Dropdown-Listen.
                </Alert>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Team-Mitglieder ({responsibles.length})
                </Typography>
                <List>
                  {responsibles.map((resp, index) => (
                    <ListItem key={index} divider>
                      <ListItemText 
                        primary={resp}
                        secondary={`Mitglied #${index + 1}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton color="error" onClick={() => deleteResponsible(resp)}>
                          🗑️
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
                
                {responsibles.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    Keine Team-Mitglieder konfiguriert. Füge welche hinzu, um Karten zuzuweisen.
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 3: Checklisten */}
      {configTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Checklisten pro Spalte
                </Typography>
                
                <Alert severity="info" sx={{ mb: 3 }}>
                  Definiere spezifische Checklisten für jede Spalte. Diese werden automatisch in den Karten angezeigt.
                </Alert>
                
                <Grid container spacing={2}>
                  {cols.map(col => (
                    <Grid item xs={12} md={6} key={col.id}>
                      <Paper sx={{ p: 2, border: 1, borderColor: 'divider' }}>
                        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          {col.name}
                          <Chip 
                            label={`${(checklists[col.name] || []).length} Items`} 
                            size="small" 
                            color="primary"
                          />
                        </Typography>
                        
                        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                          <TextField
                            size="small"
                            fullWidth
                            label="Neuer Checklistenpunkt"
                            value={selectedColumn === col.name ? newChecklistItem : ''}
                            onChange={(e) => {
                              setSelectedColumn(col.name);
                              setNewChecklistItem(e.target.value);
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                setSelectedColumn(col.name);
                                addChecklistItem();
                              }
                            }}
                          />
                          <Button 
                            variant="outlined" 
                            onClick={() => {
                              setSelectedColumn(col.name);
                              addChecklistItem();
                            }}
                          >
                            +
                          </Button>
                        </Box>

                        <List dense>
                          {(checklists[col.name] || []).map((item: string, index: number) => (
                            <ListItem key={index} sx={{ px: 0 }}>
                              <ListItemText 
                                primary={item}
                                secondary={`#${index + 1}`}
                              />
                              <ListItemSecondaryAction>
                                <IconButton 
                                  size="small" 
                                  color="error"
                                  onClick={() => deleteChecklistItem(col.name, index)}
                                >
                                  ×
                                </IconButton>
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                        
                        {!(checklists[col.name] || []).length && (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                            Keine Checkliste definiert
                          </Typography>
                        )}
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 4: Allgemein */}
      {configTab === 4 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Board-Einstellungen
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Board-Name"
                    value={boardSettings.name}
                    onChange={(e) => setBoardSettings({...boardSettings, name: e.target.value})}
                    fullWidth
                  />
                  
                  <TextField
                    label="Beschreibung"
                    multiline
                    rows={3}
                    value={boardSettings.description}
                    onChange={(e) => setBoardSettings({...boardSettings, description: e.target.value})}
                    fullWidth
                  />
                  
                  <Divider />
                  
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={boardSettings.dragDropEnabled}
                        onChange={(e) => setBoardSettings({...boardSettings, dragDropEnabled: e.target.checked})}
                      />
                    }
                    label="Drag & Drop aktiviert"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={boardSettings.wipLimitsEnabled}
                        onChange={(e) => setBoardSettings({...boardSettings, wipLimitsEnabled: e.target.checked})}
                      />
                    }
                    label="WIP-Limits aktiviert"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={boardSettings.autoArchive}
                        onChange={(e) => setBoardSettings({...boardSettings, autoArchive: e.target.checked})}
                      />
                    }
                    label="Automatische Archivierung"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={boardSettings.emailNotifications}
                        onChange={(e) => setBoardSettings({...boardSettings, emailNotifications: e.target.checked})}
                      />
                    }
                    label="E-Mail Benachrichtigungen"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={boardSettings.colorCoding}
                        onChange={(e) => setBoardSettings({...boardSettings, colorCoding: e.target.checked})}
                      />
                    }
                    label="Farbkodierung aktiviert"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Board-Statistiken
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Spalten:</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{cols.length}</Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Swimlanes:</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{lanes.length}</Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Team-Mitglieder:</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{responsibles.length}</Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Checklisten-Items:</Typography>
                    <Typography sx={{ fontWeight: 600 }}>
                      {Object.values(checklists).reduce((sum: number, items: any) => sum + (items?.length || 0), 0)}
                    </Typography>
                  </Box>
                  
                  <Divider />
                  
                  <Typography variant="body2" color="text.secondary">
                    Board-ID: {boardId}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary">
                    Letzte Änderung: {new Date().toLocaleString('de-DE')}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
            
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Aktionen
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button variant="outlined" onClick={exportConfig} fullWidth>
                    📥 Konfiguration exportieren
                  </Button>
                  
                  <Button variant="outlined" component="label" fullWidth>
                    📤 Konfiguration importieren
                    <input
                      type="file"
                      accept=".json"
                      hidden
                      onChange={importConfig}
                    />
                  </Button>
                  
                  <Button 
                    variant="outlined" 
                    color="warning"
                    onClick={() => {
                      if (window.confirm('Board-Konfiguration wirklich zurücksetzen?')) {
                        setCols([
                          { id: 'backlog', name: 'Backlog', done: false, wip: null },
                          { id: 'progress', name: 'In Bearbeitung', done: false, wip: 3 },
                          { id: 'done', name: 'Fertig', done: true, wip: null }
                        ]);
                        setLanes(['Standard']);
                        setResponsibles([]);
                        setChecklists({});
                        setBoardSettings({
                          name: `Board ${boardId}`,
                          description: '',
                          dragDropEnabled: true,
                          autoArchive: true,
                          emailNotifications: false,
                          wipLimitsEnabled: true,
                          colorCoding: true
                        });
                      }
                    }}
                    fullWidth
                  >
                    🔄 Auf Standard zurücksetzen
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
