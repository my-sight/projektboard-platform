'use client';

import { useState, useEffect } from 'react';
import { ExtendedCard } from '@/types';

interface CardEditModalProps {
  card: ExtendedCard;
  onSave: (card: ExtendedCard) => void;
  onClose: () => void;
}

export default function CardEditModal({ card, onSave, onClose }: CardEditModalProps) {
  const [editedCard, setEditedCard] = useState<ExtendedCard>(card);

  useEffect(() => {
    // Add show class for animation
    const modal = document.getElementById('editModal');
    if (modal) {
      setTimeout(() => modal.classList.add('show'), 10);
    }
  }, []);

  const handleSave = () => {
    onSave(editedCard);
  };

  const handleClose = () => {
    const modal = document.getElementById('editModal');
    if (modal) {
      modal.classList.remove('show');
      setTimeout(onClose, 300);
    } else {
      onClose();
    }
  };

  return (
    <div 
      id="editModal" 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0,
        transition: 'opacity 0.6s ease-in-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        className="modal-box"
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          transform: 'scale(0.92)',
          transition: 'transform 0.6s ease-in-out'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: 'var(--ink)' }}>Karte bearbeiten</h2>
          <button 
            className="btn" 
            onClick={handleClose}
            style={{ padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        {/* Basic Form */}
        <div>
          <div className="editrow" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 10px', alignItems: 'center', marginBottom: '12px' }}>
            <label>Titel:</label>
            <input
              type="text"
              value={editedCard.title}
              onChange={(e) => setEditedCard(prev => ({ ...prev, title: e.target.value }))}
              style={{
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--ink)',
                padding: '6px 8px',
                borderRadius: '8px'
              }}
            />
          </div>

          <div className="editrow" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 10px', alignItems: 'center', marginBottom: '12px' }}>
            <label>Beschreibung:</label>
            <textarea
              value={editedCard.description || ''}
              onChange={(e) => setEditedCard(prev => ({ ...prev, description: e.target.value }))}
              style={{
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--ink)',
                padding: '8px',
                borderRadius: '8px',
                minHeight: '80px',
                resize: 'vertical'
              }}
            />
          </div>

          <div className="editrow" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 10px', alignItems: 'center', marginBottom: '12px' }}>
            <label>Priorität:</label>
            <select
              value={editedCard.priority}
              onChange={(e) => setEditedCard(prev => ({ 
                ...prev, 
                priority: e.target.value as 'low' | 'medium' | 'high' 
              }))}
              style={{
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--ink)',
                padding: '6px 8px',
                borderRadius: '8px'
              }}
            >
              <option value="low">Niedrig</option>
              <option value="medium">Mittel</option>
              <option value="high">Hoch</option>
            </select>
          </div>

          <div className="editrow" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 10px', alignItems: 'center', marginBottom: '12px' }}>
            <label>Fälligkeitsdatum:</label>
            <input
              type="date"
              value={editedCard.due_date || ''}
              onChange={(e) => setEditedCard(prev => ({ ...prev, due_date: e.target.value }))}
              style={{
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--ink)',
                padding: '6px 8px',
                borderRadius: '8px'
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
          <button className="btn" onClick={handleClose}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={handleSave}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
