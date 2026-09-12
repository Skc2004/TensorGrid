import React, { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { submitPipeline } from './api';

const initialNodes = [
  { id: '1', position: { x: 250, y: 5 }, data: { label: 'Data Ingestion (S3)' }, style: { background: 'rgba(31, 41, 55, 0.9)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' } },
  { id: '2', position: { x: 100, y: 100 }, data: { label: 'Preprocessing (Spark)' }, style: { background: 'rgba(31, 41, 55, 0.9)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' } },
  { id: '3', position: { x: 400, y: 100 }, data: { label: 'Feature Engineering' }, style: { background: 'rgba(31, 41, 55, 0.9)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' } },
  { id: '4', position: { x: 250, y: 200 }, data: { label: 'Model Training (PyTorch)' }, style: { background: 'rgba(59, 130, 246, 0.9)', color: '#fff', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '8px', boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)' } },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#fff' } },
  { id: 'e1-3', source: '1', target: '3', animated: true, style: { stroke: '#fff' } },
  { id: 'e2-4', source: '2', target: '4', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
  { id: 'e3-4', source: '3', target: '4', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
];

export default function PipelineBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#fff' } }, eds)), [setEdges]);

  const handleDeploy = async () => {
    try {
      const payload = { nodes, edges };
      const res = await submitPipeline(payload);
      alert("DAG Pipeline deployed successfully! Job ID: " + res.job_id);
    } catch (err) {
      alert("Error deploying pipeline: " + err.message);
    }
  };

  return (
    <div className="card" style={{ width: '100%', height: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }} className="gradient-text">Visual DAG Builder</h2>
          <p style={{ margin: '5px 0 0', color: '#9ca3af', fontSize: '0.9rem' }}>Drag and connect nodes to create complex execution graphs.</p>
        </div>
        <button className="primary-btn" onClick={handleDeploy}>Deploy Pipeline</button>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          colorMode="dark"
        >
          <Controls />
          <MiniMap nodeStrokeColor="#ffffff" nodeColor="rgba(59, 130, 246, 0.5)" maskColor="rgba(0,0,0,0.5)" style={{ background: 'rgba(17, 24, 39, 0.8)' }} />
          <Background variant="dots" gap={16} size={1} color="rgba(255,255,255,0.15)" />
        </ReactFlow>
      </div>
    </div>
  );
}
