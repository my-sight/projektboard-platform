'use client';

import { useState, useEffect } from 'react';
import { ExtendedCard, StatusEntry } from '@/types';

interface CardEditModalProps {
  card: ExtendedCard;
  onSave: (card: ExtendedCard) => void;
  onClose: () => void;
}

export default function CardEditModal({ card, onSave, onClose }: CardEditModalProps) {
  const [editedCard, setEditedCard] = useState<ExtendedCard>(card);
  const [activeTab, setActiveTab] = useState<'basic' | 'status' | 'checklist' | 'attachments'>('basic');
  const [newStatusEntry, setNewStatusEntry] = useState<StatusEntry>({
    date: new Date().toISOString().split('T')[0],
    message: { text: '', escalation: false },
    quality: { text: '', escalation: false },
    costs: { text: '', escalation: false },
    deadlines: { text: '', escalation: false }
  });

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
      setTimeout(onClose, 300); // Wait for animation
    } else {
      onClose();
    }
  };

  const handleAddStatusEntry = () => {
    const updatedHistory = [newStatusEntry, ...(editedCard.status_history || [])];
    setEditedCard(prev => ({
      ...prev,
      status_history: updatedHistory,
      metadata: {
        ...prev.metadata,
        status_history: updatedHistory
      }
    }));
    
    // Reset form
    setNewStatusEntry({
      date: new Date().toISOString().split('T')[0],
      message: { text: '', escalation: false },
      quality: { text: '', escalation: false },
      costs: { text: '', escalation: false },
      deadlines: { text: '', escalation: false }
    });
  };

  const handleDeleteStatusEntry = (index: number) => {
    const updatedHistory = editedCard.status_history?.filter((_, i) => i !== index) || [];
    setEditedCard(prev => ({
      ...prev,
      status_history: updatedHistory,
      metadata: {
        ...prev.metadata,
        status_history: updatedHistory
      }
    }));
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
          maxWidth: '800px',
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

        {/* Tabs */}
        <nav className="kanban-nav" style={{ marginBottom: '20px' }}>
          <button
            className={`btn ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            Grunddaten
          </button>
          <button
            className={`btn ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
          >
            Statusverlauf
          </button>
          <button
            className={`btn ${activeTab === 'checklist' ? 'active' : ''}`}
            onClick={() => setActiveTab('checklist')}
          >
            Checklisten
          </button>
          <button
            className={`btn ${activeTab === 'attachments' ? 'active' : ''}`}
            onClick={() => setActiveTab('attachments')}
          >
            Anhänge
          </button>
        </nav>

        {/* Tab Content */}
        {activeTab === 'basic' && (
          <div>
            <div className="editrow">
              <label>Titel:</label>
              <input
                type="text"
                value={editedCard.title}
                onChange={(e) => setEditedCard(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="editrow">
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
                  minHeight: '100px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div className="editrow">
              <label>Priorität:</label>
              <select
                value={editedCard.priority}
                onChange={(e) => setEditedCard(prev => ({ 
                  ...prev, 
                  priority: e.target.value as 'low' | 'medium' | 'high' 
                }))}
              >
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
              </select>
            </div>

            <div className="editrow">
              <label>Fälligkeitsdatum:</label>
              <input
                type="date"
                value={editedCard.due_date || ''}
                onChange={(e) => setEditedCard(prev => ({ ...prev, due_date: e.target.value }))}
                className={editedCard.due_date && new Date(editedCard.due_date) < new Date() ? 'overdue' : ''}
              />
            </div>

            <div className="editrow">
              <label>Bereich:</label>
              <input
                type="text"
                value={editedCard.swimlane || ''}
                onChange={(e) => setEditedCard(prev => ({ 
                  ...prev, 
                  swimlane: e.target.value,
                  metadata: { ...prev.metadata, swimlane: e.target.value }
                }))}
                placeholder="z.B. Entwicklung, Marketing, etc."
              />
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <div>
            <h3>Neuen Statuseintrag hinzufügen</h3>
            
            <div className="editrow">
              <label>Datum:</label>
              <input
                type="date"
                value={newStatusEntry.date}
                onChange={(e) => setNewStatusEntry(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <table className="status-table">
              <thead>
                <tr>
                  <th>Bereich</th>
                  <th>Text</th>
                  <th>Eskalation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Nachricht</td>
                  <td>
                    <input
                      type="text"
                      value={newStatusEntry.message.text}
                      onChange={(e) => setNewStatusEntry(prev => ({
                        ...prev,
                        message: { ...prev.message, text: e.target.value }
                      }))}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={newStatusEntry.message.escalation}
                      onChange={(e) => setNewStatusEntry(prev => ({
                        ...prev,
                        message: { ...prev.message, escalation: e.target.checked }
                      }))}
                    />
                  </td>
                </tr>
                <tr>
                  <td>Qualität</td>
                  <td>
                    <input
                      type="text"
                      value={newStatusEntry.quality.text}
                      onChange={(e) => setNewStatusEntry(prev => ({
                        ...prev,
                        quality: { ...prev.quality, text: e.target.value }
                      }))}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={newStatusEntry.quality.escalation}
                      onChange={(e) => setNewStatusEntry(prev => ({
                        ...prev,
                        quality: { ...prev.quality, escalation: e.target.checked }
                      }))}
                    />
                  </td>
                </tr>
                <tr>
                  <td>Kosten</td>
                  <td>
                    <input
                      type="text"
                      value={newStatusEntry.costs.text}
                      onChange={(e) => setNewStatusEntry(prev => ({
                        ...prev,
                        costs: { ...prev.costs, text: e.target.value }
                      }))}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={newStatusEntry.costs.escalation}
                      onChange={(e) => setNewStatusEntry(prev => ({
                        ...prev,
                        costs: { ...prev.costs, escalation: e.target.checked }
                      }))}
                    />
                  </td>
                </tr>
                <tr>
                  <td>Termine</td>
                  <td>
                    <input
                      type="text"
                      value={newStatusEntry.deadlines.text}
                      onChange={(e) => setNewStatusEntry(prev => ({
                        ...prev,
                        deadlines: { ...prev.deadlines, text: e.target.value }
                      }))}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={newStatusEntry.deadlines.escalation}
                      onChange={(e) => setNewStatusEntry(prev => ({
                        ...prev,
                        deadlines: { ...prev.deadlines, escalation: e.target.checked }
                      }))}
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <button className="btn primary" onClick={handleAddStatusEntry}>
              Statuseintrag hinzufügen
            </button>

            {/* Existing status entries */}
            <div id="statusTablesContainer" style={{ marginTop: '20px' }}>
              <h3>Bisherige Statuseinträge</h3>
              {editedCard.status_history?.map((entry, index) => (
                <div key={index} style={{ marginBottom: '16px', padding: '12px', border: '1px solid var(--line)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong>{new Date(entry.date).toLocaleDateString('de-DE')}</strong>
                    <button 
                      className="btn danger"
                      onClick={() => handleDeleteStatusEntry(index)}
                      style={{ padding: '2px 6px', fontSize: '12px' }}
                    >
                      Löschen
                    </button>
                  </div>
                  
                  {entry.message.text && (
                    <div className="sub">
                      <strong>Nachricht:</strong> {entry.message.text}
                      {entry.message.escalation && <span className="chip esk-sk">Eskaliert</span>}
                    </div>
                  )}
                  
                  {entry.quality.text && (
                    <div className="sub">
                      <strong>Qualität:</strong> {entry.quality.text}
                      {entry.quality.escalation && <span className="chip esk-sk">Eskaliert</span>}
                    </div>
                  )}
                  
                  {entry.costs.text && (
                    <div className="sub">
                      <strong>Kosten:</strong> {entry.costs.text}
                      {entry.costs.escalation && <span className="chip esk-sk">Eskaliert</span>}
                    </div>
                  )}
                  
                  {entry.deadlines.text && (
                    <div className="sub">
                      <strong>Termine:</strong> {entry.deadlines.text}
                      {entry.deadlines.escalation && <span className="chip esk-sk">Eskaliert</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'checklist' && (
          <div>
            <h3>Checklisten</h3>
            <p className="muted">Checklisten-Funktionalität wird hier implementiert...</p>
          </div>
        )}

        {activeTab === 'attachments' && (
          <div>
            <h3>Anhänge</h3>
            <p className="muted">Anhang-Funktionalität wird hier implementiert...</p>
          </div>
        )}

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
