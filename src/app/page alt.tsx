'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from 'recharts';

interface DashboardProps {
  boardId?: string;
  rows?: any[];
  cols?: { name: string; done?: boolean }[];
}

// Wichtig: Next.js ruft page.tsx ohne Props auf.
// Wir setzen daher Defaults direkt in der Funktionssignatur.
export default function DashboardPage({
  boardId = '',
  rows: rowsProp = [],
  cols: colsProp = []
}: DashboardProps = {}) {
  const [timeRange, setTimeRange] = useState('30');
  const [selectedMetric, setSelectedMetric] = useState('overview');

  // Sichere Arrays (verhindert undefined.filter)
  const rows = Array.isArray(rowsProp) ? rowsProp : [];
  const cols = Array.isArray(colsProp) ? colsProp : [];

  // Filtere aktive Karten (wenn "Archived" fehlt, behandeln wir als nicht archiviert)
  const activeCards = rows.filter(r => !r?.['Archived']);

  // Berechnungen defensiv
  const totalCards = activeCards.length;

  const completedCards = activeCards.filter(r => {
    const stageName = r?.['Status'] || r?.['Phase'] || 'Backlog';
    const stage = cols.find(c => c?.name === stageName);
    return !!stage?.done;
  }).length;

  const now = new Date();
  const overdueCards = activeCards.filter(r => {
    const due = r?.['Due Date'] ? new Date(r['Due Date']) : null;
    return !!(due && due < now);
  }).length;

  const escalatedCards = activeCards.filter(r =>
    r?.StatusSummary?.escalations?.lk || r?.StatusSummary?.escalations?.sk
  ).length;

  // Chart-Daten sicher aufbauen
  const stageData = (cols.length ? cols : [{ name: 'Backlog', done: false }]).map(col => ({
    name: col.name,
    count: activeCards.filter(r => (r?.['Status'] || r?.['Phase'] || 'Backlog') === col.name).length,
    color: col.done ? '#4caf50' : col.name === 'Backlog' ? '#9e9e9e' : '#2196f3'
  }));

  const responsibleSet = new Set(
    activeCards.map(r => r?.['Verantwortlich'] || 'Unassigned')
  );
  const responsibleData = Array.from(responsibleSet).map(resp => {
    const count = activeCards.filter(r => (r?.['Verantwortlich'] || 'Unassigned') === resp).length;
    const completed = activeCards.filter(r => {
      const stageName = r?.['Status'] || r?.['Phase'] || 'Backlog';
      const stage = cols.find(c => c?.name === stageName);
      return (r?.['Verantwortlich'] || 'Unassigned') === resp && !!stage?.done;
    }).length;
    return { name: resp as string, count, completed };
  });

  const ampelData = [
    { name: 'Grün', count: activeCards.filter(r => (r?.['Ampel'] || '').toLowerCase().startsWith('grün')).length, color: '#4caf50' },
    { name: 'Gelb', count: activeCards.filter(r => (r?.['Ampel'] || '').toLowerCase().startsWith('gelb')).length, color: '#ff9800' },
    { name: 'Rot',  count: activeCards.filter(r => (r?.['Ampel'] || '').toLowerCase().startsWith('rot')).length,  color: '#f44336' }
  ];

  // Demo-Trend-Daten (falls du echte willst: hier ersetzen)
  const trendData = Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }),
    completed: Math.floor(Math.random() * 5) + 1,
    created: Math.floor(Math.random() * 3) + 1
  }));

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Dashboard
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Zeitraum</InputLabel>
            <Select
              value={timeRange}
              label="Zeitraum"
              onChange={(e) => setTimeRange(String(e.target.value))}
            >
              <MenuItem value="7">7 Tage</MenuItem>
              <MenuItem value="30">30 Tage</MenuItem>
              <MenuItem value="90">90 Tage</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Ansicht</InputLabel>
            <Select
              value={selectedMetric}
              label="Ansicht"
              onChange={(e) => setSelectedMetric(String(e.target.value))}
            >
              <MenuItem value="overview">Übersicht</MenuItem>
              <MenuItem value="performance">Performance</MenuItem>
              <MenuItem value="quality">Qualität</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* KPIs */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>Gesamt Karten</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main' }}>{totalCards}</Typography>
              <Typography variant="body2" color="text.secondary">Aktive Projekte</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>Abgeschlossen</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'success.main' }}>{completedCards}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={totalCards > 0 ? (completedCards / totalCards) * 100 : 0}
                  sx={{ flex: 1, mr: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>Überfällig</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'error.main' }}>{overdueCards}</Typography>
              <Typography variant="body2" color="text.secondary">Termine überschritten</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" color="text.secondary" gutterBottom>Eskalationen</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'warning.main' }}>{escalatedCards}</Typography>
              <Typography variant="body2" color="text.secondary">LK/SK Meldungen</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Phasen-Verteilung */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Verteilung nach Phasen</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stageData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, count }) => `${name}: ${count}`}
                    outerRadius={80}
                    dataKey="count"
                  >
                    {stageData.map((entry, index) => (
                      <Cell key={`stage-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Ampel-Status */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Ampel-Status</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ampelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count">
                    {ampelData.map((entry, index) => (
                      <Cell key={`ampel-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Trend-Analyse */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Trend-Analyse (letzte 7 Tage)</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="completed" stroke="#4caf50" name="Abgeschlossen" />
                  <Line type="monotone" dataKey="created"   stroke="#2196f3" name="Erstellt" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Team Performance */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Team Performance</Typography>
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {responsibleData.map((person, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{person.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {person.completed}/{person.count}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={person.count > 0 ? (person.completed / person.count) * 100 : 0}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Aktuelle Probleme */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Aktuelle Probleme &amp; Eskalationen</Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Karte</TableCell>
                  <TableCell>Verantwortlich</TableCell>
                  <TableCell>Problem</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Fällig</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeCards
                  .filter(card =>
                    card?.StatusSummary?.escalations?.lk ||
                    card?.StatusSummary?.escalations?.sk ||
                    (card?.['Due Date'] && new Date(card['Due Date']) < now)
                  )
                  .slice(0, 10)
                  .map((card, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {card?.['Nummer'] ?? '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {card?.['Teil'] ?? ''}
                        </Typography>
                      </TableCell>
                      <TableCell>{card?.['Verantwortlich'] ?? '—'}</TableCell>
                      <TableCell>
                        {card?.StatusSummary?.escalations?.lk && (
                          <Chip label="LK Eskalation" color="warning" size="small" sx={{ mr: 0.5 }} />
                        )}
                        {card?.StatusSummary?.escalations?.sk && (
                          <Chip label="SK Eskalation" color="error" size="small" sx={{ mr: 0.5 }} />
                        )}
                        {card?.['Due Date'] && new Date(card['Due Date']) < now && (
                          <Chip label="Überfällig" color="error" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={card?.['Status'] || card?.['Phase'] || 'Backlog'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {card?.['Due Date'] ? String(card['Due Date']).slice(0, 10) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>

          {activeCards.filter(card =>
            card?.StatusSummary?.escalations?.lk ||
            card?.StatusSummary?.escalations?.sk ||
            (card?.['Due Date'] && new Date(card['Due Date']) < now)
          ).length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">🎉 Keine aktuellen Probleme gefunden!</Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
