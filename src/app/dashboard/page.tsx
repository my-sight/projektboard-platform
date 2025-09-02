'use client';

import { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Container,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions
} from '@mui/material';
import OriginalKanbanBoard from '@/components/kanban/OriginalKanbanBoard';

export default function HomePage() {
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);

  // Beispiel-Boards
  const boards = [
    {
      id: 'werkzeug-board',
      name: 'Werkzeug-Multiprojektboard',
      description: 'Hauptboard für alle Werkzeugprojekte',
      cardCount: 15,
      lastUpdated: '2024-01-25'
    },
    {
      id: 'prototyp-board', 
      name: 'Prototyping Board',
      description: 'Board für Prototyp-Entwicklung',
      cardCount: 8,
      lastUpdated: '2024-01-24'
    },
    {
      id: 'produktion-board',
      name: 'Produktions-Board', 
      description: 'Board für Produktionsplanung',
      cardCount: 23,
      lastUpdated: '2024-01-23'
    }
  ];

  if (selectedBoard) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header mit Zurück-Button */}
        <Box sx={{ 
          p: 2, 
          borderBottom: '1px solid var(--line)',
          backgroundColor: 'var(--panel)',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <Button 
            variant="outlined" 
            onClick={() => setSelectedBoard(null)}
            sx={{ minWidth: 'auto' }}
          >
            ← Zurück
          </Button>
          <Typography variant="h6">
            {boards.find(b => b.id === selectedBoard)?.name}
          </Typography>
        </Box>

        {/* Board */}
        <Box sx={{ flex: 1 }}>
          <OriginalKanbanBoard boardId={selectedBoard} />
        </Box>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" sx={{ mb: 2, fontWeight: 700 }}>
          Kanban Board System
        </Typography>
        <Typography variant="h6" sx={{ color: 'var(--muted)', mb: 4 }}>
          Verwalte deine Projekte mit modernen Kanban-Boards
        </Typography>
      </Box>

      {/* Board Auswahl */}
      <Grid container spacing={3}>
        {boards.map((board) => (
          <Grid item xs={12} md={6} lg={4} key={board.id}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--panel)',
                border: '1px solid var(--line)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                }
              }}
            >
              <CardContent sx={{ flex: 1 }}>
                <Typography variant="h6" component="h2" sx={{ mb: 1, fontWeight: 600 }}>
                  {board.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--muted)', mb: 2 }}>
                  {board.description}
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
                    {board.cardCount} Karten
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
                    {board.lastUpdated}
                  </Typography>
                </Box>
              </CardContent>
              
              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button 
                  variant="contained" 
                  fullWidth
                  onClick={() => setSelectedBoard(board.id)}
                  sx={{ 
                    backgroundColor: 'var(--accent)',
                    '&:hover': {
                      backgroundColor: 'var(--accent)',
                      filter: 'brightness(1.1)'
                    }
                  }}
                >
                  Board öffnen
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}

        {/* Neues Board erstellen */}
        <Grid item xs={12} md={6} lg={4}>
          <Card 
            sx={{ 
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--panel)',
              border: '2px dashed var(--line)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: 'var(--accent)',
                backgroundColor: 'var(--chip)'
              }
            }}
          >
            <CardContent sx={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}>
              <Typography variant="h1" sx={{ fontSize: '3rem', mb: 2, opacity: 0.3 }}>
                +
              </Typography>
              <Typography variant="h6" sx={{ mb: 1, color: 'var(--muted)' }}>
                Neues Board erstellen
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--muted)' }}>
                Erstelle ein neues Kanban-Board für dein Projekt
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Features Section */}
      <Box sx={{ mt: 6, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
          Features
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h2" sx={{ fontSize: '2rem', mb: 2 }}>
                🎯
              </Typography>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Drag & Drop
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--muted)' }}>
                Intuitive Bedienung durch Drag & Drop zwischen Spalten und Swimlanes
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h2" sx={{ fontSize: '2rem', mb: 2 }}>
                📊
              </Typography>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Flexible Ansichten
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--muted)' }}>
                Spalten, Swimlanes nach Verantwortlichen oder Kategorien
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h2" sx={{ fontSize: '2rem', mb: 2 }}>
                ⚡
              </Typography>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Ampel-System
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--muted)' }}>
                Statusverfolgung mit Ampelfarben und LK/SK Eskalationen
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h2" sx={{ fontSize: '2rem', mb: 2 }}>
                📝
              </Typography>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Checklisten
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--muted)' }}>
                Phasenspezifische Checklisten für strukturierte Abarbeitung
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h2" sx={{ fontSize: '2rem', mb: 2 }}>
                📈
              </Typography>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Statushistorie
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--muted)' }}>
                Detaillierte Verfolgung von Qualität, Kosten und Terminen
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h2" sx={{ fontSize: '2rem', mb: 2 }}>
                🎨
              </Typography>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Responsive Design
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--muted)' }}>
                Optimiert für Desktop und Mobile mit Dark/Light Mode
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* CSS Variables */}
      <style jsx global>{`
        :root {
          --bg: #0f1117;
          --panel: #141a22;
          --ink: #e6e8ee;
          --muted: #9aa3b2;
          --accent: #4aa3ff;
          --line: #243042;
          --chip: #1a2230;
          --alert: #5a1b1b;
          --alertBorder: #a33;
          --ok: #19c37d;
          --colw: 320px;
          --rowheadw: 200px;
        }
        
        @media (prefers-color-scheme: light) {
          :root {
            --bg: #f5f7fb;
            --panel: #ffffff;
            --ink: #0b1220;
            --muted: #566175;
            --accent: #2458ff;
            --line: #e6eaf2;
            --chip: #eef3ff;
            --alert: #ffe8e8;
            --alertBorder: #ff6b6b;
            --ok: #0ea667;
          }
        }
        
        body {
          background-color: var(--bg);
          color: var(--ink);
        }
      `}</style>
    </Container>
  );
}
