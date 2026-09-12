import React, { useState, useEffect, useRef } from 'react';

export default function LiveTerminal({ jobId, onClose }) {
  const [logs, setLogs] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom whenever new logs arrive
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (!jobId) return;

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const eventSource = new EventSource(`${API_URL}/jobs/logs/stream/${jobId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.stdout) {
          setLogs(prev => [...prev, { type: 'stdout', text: data.stdout }]);
        }
        if (data.stderr) {
          setLogs(prev => [...prev, { type: 'stderr', text: data.stderr }]);
        }
        if (data.stdout && data.stdout.includes('Training complete')) {
          eventSource.close();
        }
      } catch (err) {
        console.error("Error parsing SSE data", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [jobId]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div className="card" style={{ width: '800px', maxWidth: '95%', background: '#0a0a0a', border: '1px solid #333' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse 2s infinite' }}></span>
            Live Terminal - {jobId}
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
        </div>
        
        <div style={{ background: '#000', color: '#0f0', padding: '15px', borderRadius: '4px', overflowY: 'auto', height: '400px', fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.5' }}>
          {logs.length === 0 && <span style={{ color: '#888' }}>Connecting to node agent...</span>}
          {logs.map((log, index) => (
            <div key={index} style={{ color: log.type === 'stderr' ? '#ef4444' : '#10b981', whiteSpace: 'pre-wrap' }}>
              {log.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
