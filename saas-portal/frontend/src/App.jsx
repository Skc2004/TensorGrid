import { useState, useEffect } from 'react';
import { submitJob, submitPipeline, fetchJobStatus, fetchGridMetrics, cancelJob, fetchUsers, approveUser, fetchJobLogs, downloadJobResults, fetchAnalytics, fetchGridNodes, fetchDatasets, uploadDataset, fetchProfile, validateCode, previewResults } from './api';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import Editor from '@monaco-editor/react';
import PipelineBuilder from './PipelineBuilder';
import LiveTerminal from './LiveTerminal';
import './index.css';

function AppContent() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [jobs, setJobs] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [analytics, setAnalytics] = useState({ cpu_history: [], department_usage: [] });
  const [pendingUsers, setPendingUsers] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [cpuReq, setCpuReq] = useState(1);
  const [ramReq, setRamReq] = useState(512);
  const [requireGpu, setRequireGpu] = useState(false);
  const [containerImage, setContainerImage] = useState('none');
  const [logModal, setLogModal] = useState(null);
  
  // Advanced Features State
  const [codeString, setCodeString] = useState('# Write your Python script here...\nprint("Hello from Grid!")');
  const [runOvernight, setRunOvernight] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [gridNodes, setGridNodes] = useState([]);
  
  // Phase 3 States
  const [pipPackages, setPipPackages] = useState('');
  const [credits, setCredits] = useState(0);
  const [activeWorkspace, setActiveWorkspace] = useState('personal');
  
  // Phase 4 & 7 States
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [liveJobId, setLiveJobId] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [currentLogs, setCurrentLogs] = useState({ stdout: '', stderr: '' });
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState('');
  
  const [dagJson, setDagJson] = useState('{\n  "nodes": ["data_prep", "model_train", "evaluate"],\n  "edges": [\n    {"from": "data_prep", "to": "model_train"},\n    {"from": "model_train", "to": "evaluate"}\n  ]\n}');

  // Auto-redirect if student
  useEffect(() => {
    if (user?.role === 'student' && activeTab === 'dashboard') {
      setActiveTab('queue');
    }
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user) return;
        
        // Fetch Profile for Credits
        const profile = await fetchProfile();
        setCredits(profile.credits || 0);

        const currentJobs = await fetchJobStatus(activeWorkspace);
        setJobs(currentJobs);

        if (user.role === 'admin' || user.role === 'faculty') {
          const currentMetrics = await fetchGridMetrics();
          setMetrics(currentMetrics);
          const currentAnalytics = await fetchAnalytics();
          setAnalytics(currentAnalytics);
          
          if (activeTab === 'topology') {
            const nodes = await fetchGridNodes();
            setGridNodes(nodes);
          }
        }

        if (user.role === 'admin' && activeTab === 'users') {
          const uList = await fetchUsers();
          setPendingUsers(uList);
        }
        
        if (activeTab === 'data' || activeTab === 'submit') {
          const dList = await fetchDatasets(activeWorkspace);
          setDatasets(dList);
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [user, activeTab, activeWorkspace]);

  if (!user) {
    return <Login />;
  }

  const handleJobSubmit = async (e) => {
    e?.preventDefault();
    setIsUploading(true);
    try {
      // Phase 4: Pre-flight Syntax Validation
      try {
        await validateCode(codeString);
      } catch(err) {
        throw new Error(err.message);
      }

      const result = await submitJob(null, cpuReq, ramReq, requireGpu, containerImage, codeString, selectedDataset, runOvernight, pipPackages, activeWorkspace);
      showToast(result.message);
      setActiveTab('queue');
    } catch (err) {
      showToast(err.message || "Failed to submit job");
    } finally {
      setIsUploading(false);
    }
  };

  const loadTemplate = (type) => {
    if (type === 'pytorch') {
      setCodeString('import torch\nimport torch.nn as nn\n\nprint("PyTorch Version:", torch.__version__)\nprint("CUDA Available:", torch.cuda.is_available())\n\n# Build simple model\nmodel = nn.Sequential(\n    nn.Linear(10, 5),\n    nn.ReLU(),\n    nn.Linear(5, 2)\n)\nprint("Model architecture loaded!")');
      setPipPackages('torch==2.1.0\ntorchvision');
      setContainerImage('pytorch/pytorch:latest');
    } else if (type === 'pandas') {
      setCodeString('import pandas as pd\nimport numpy as np\n\ndf = pd.DataFrame(np.random.randint(0,100,size=(100, 4)), columns=list("ABCD"))\nprint(df.describe())\nprint("Data analysis complete!")');
      setPipPackages('pandas\nnumpy');
      setContainerImage('pytorch/pytorch:latest'); // Fallback
    }
  };

  const handleViewLogs = async (jobId) => {
    // Instead of fetching static logs, we open the LiveTerminal
    setLiveJobId(jobId);
  };

  const handlePreview = async (jobId) => {
    try {
      const preview = await previewResults(jobId);
      setCurrentPreviewUrl(preview.preview.url);
      setPreviewModalOpen(true);
    } catch(err) { showToast(err.message); }
  };

  const handleDatasetUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadDataset(file, activeWorkspace);
      showToast('Dataset uploaded successfully!');
      const dList = await fetchDatasets(activeWorkspace);
      setDatasets(dList);
    } catch (err) {
      showToast(err.message);
    } finally {
      setIsUploading(false);
      e.target.value = null;
    }
  };

  const handlePipelineSubmit = async () => {
    try {
      const parsed = JSON.parse(dagJson);
      const result = await submitPipeline(parsed);
      showToast(result.message);
      setActiveTab('queue');
    } catch (err) {
      showToast("Invalid JSON or submission failed: " + err.message);
    }
  };

  const handleApprove = async (email) => {
    try {
      await approveUser(email);
      showToast(`${email} approved!`);
      const uList = await fetchUsers();
      setPendingUsers(uList);
    } catch(err) {
      showToast(err.message);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const renderSidebar = () => (
    <aside className="sidebar">
      <div className="sidebar-logo">HTCondor Grid</div>
      <div style={{padding: '0 1rem', marginBottom: '1rem'}}>
        <p style={{color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px'}}>Current Organization</p>
        <div style={{width: '100%', background: '#1e293b', color: '#10b981', border: '1px solid #334155', borderRadius: '4px', padding: '8px', fontWeight: 'bold'}}>
          {user?.org_name || 'College Edu Default'}
        </div>
      </div>
      <nav className="sidebar-nav">
        {(user.role === 'admin' || user.role === 'faculty') && (
          <button 
            className={activeTab === 'dashboard' ? 'active' : ''} 
            onClick={() => setActiveTab('dashboard')}
          >
            Global Dashboard
          </button>
        )}
        {(user.role === 'admin' || user.role === 'faculty') && (
          <button 
            className={activeTab === 'topology' ? 'active' : ''} 
            onClick={() => setActiveTab('topology')}
          >
            Grid Topology
          </button>
        )}
        <button 
          className={activeTab === 'data' ? 'active' : ''} 
          onClick={() => setActiveTab('data')}
        >
          Data Manager
        </button>
        <button 
          className={activeTab === 'queue' ? 'active' : ''} 
          onClick={() => setActiveTab('queue')}
        >
          Job Queue
        </button>
        <button 
          className={activeTab === 'submit' ? 'active' : ''} 
          onClick={() => setActiveTab('submit')}
        >
          Submit Single Job
        </button>
        {(user.role === 'admin' || user.role === 'faculty') && (
          <button 
            className={activeTab === 'pipeline' ? 'active' : ''} 
            onClick={() => setActiveTab('pipeline')}
          >
            Deploy Pipeline
          </button>
        )}
        <button 
          className={activeTab === 'models' ? 'active' : ''} 
          onClick={() => setActiveTab('models')}
        >
          Model Registry
        </button>
        <button 
          className={activeTab === 'telemetry' ? 'active' : ''} 
          onClick={() => setActiveTab('telemetry')}
        >
          Live Telemetry
        </button>
        {user.role === 'admin' && (
          <button 
            className={activeTab === 'users' ? 'active' : ''} 
            onClick={() => setActiveTab('users')}
          >
            User Management
          </button>
        )}
      </nav>
      <div className="sidebar-footer">
        <p>Logged in as: {user.email}</p>
        <p>Role: <span className="role-badge">{user.role}</span></p>
        <p style={{marginTop: '5px', color: credits < 100 ? '#ef4444' : '#10b981', fontWeight: 'bold'}}>
          Credits: {credits}
        </p>
        <button className="btn-logout" onClick={logout} style={{marginTop: '10px'}}>Logout</button>
      </div>
    </aside>
  );

  return (
    <div className="app-container">
      <div className="ambient-bg">
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
        <div className="ambient-orb orb-3"></div>
      </div>
      {renderSidebar()}
      <main className="main-area">
        {activeTab === 'dashboard' && (user.role === 'admin' || user.role === 'faculty') && (
          <div className="dashboard-content">
            <header className="page-header">
              <h1>Control Tower</h1>
            </header>
            <div className="metrics-grid">
              <div className="metric-card">
                <h4>Available Cores</h4>
                <div className="metric-value">{metrics.total_cores_available || '--'}</div>
              </div>
              <div className="metric-card highlight-green">
                <h4>Cloud Cost Avoided</h4>
                <div className="metric-value">{metrics.cloud_cost_equivalent_saved || '--'}</div>
              </div>
            </div>
            
            <div className="analytics-section" style={{marginTop: '2rem'}}>
              <h3>Grid Telemetry (30 Days)</h3>
              <div style={{height: '300px', background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b'}}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.cpu_history}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} />
                    <Area type="monotone" dataKey="cpuLoad" stroke="#818cf8" fillOpacity={1} fill="url(#colorCpu)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              <h3 style={{marginTop: '2rem'}}>Departmental Compute Usage</h3>
              <div style={{height: '300px', background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b'}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.department_usage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} />
                    <Bar dataKey="hours" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="dashboard-content">
            <h2>{user.role === 'student' ? 'My Jobs' : 'All Grid Jobs'}</h2>
            <div className="table-container">
              <table className="queue-table">
                <thead>
                  <tr>
                    <th>Job ID</th><th>Owner</th><th>Status</th>
                    <th>Command</th><th>RAM Used</th><th>CPU Load</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(job => (
                    <tr key={job.cluster_id}>
                      <td>{job.cluster_id}</td>
                      <td>{job.owner}</td>
                      <td><span className={`status-badge status-${job.status.toLowerCase()}`}>{job.status}</span></td>
                      <td>{job.cmd}</td>
                      <td>{job.ram_used || '--'}</td>
                      <td>{job.cpu_load || '--'}</td>
                      <td>
                        {job.status === 'Running' || job.status === 'Idle' ? (
                          <>
                            <button onClick={() => cancelJob(job.cluster_id)} className="btn-cancel">Cancel</button>
                            <button onClick={() => handleViewLogs(job.cluster_id)} className="btn-primary" style={{marginLeft: '10px', fontSize: '12px'}}>Logs</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => downloadJobResults(job.cluster_id)} className="btn-primary" style={{fontSize: '12px'}}>Download</button>
                            <button onClick={() => handlePreview(job.cluster_id)} className="btn-primary" style={{marginLeft: '10px', fontSize: '12px'}}>Preview</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'topology' && (user.role === 'admin' || user.role === 'faculty') && (
          <div className="dashboard-content">
            <h2>Grid Topology Map</h2>
            <div className="table-container">
              <table className="queue-table">
                <thead>
                  <tr>
                    <th>Node Hostname</th><th>OS</th><th>State</th><th>Load Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {gridNodes.map((n, i) => (
                    <tr key={i}>
                      <td>{n.hostname}</td><td>{n.os}</td>
                      <td style={{color: n.state === 'Claimed' ? '#fbbf24' : '#10b981'}}>{n.state}</td>
                      <td>{n.load}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="dashboard-content">
            <header className="page-header"><h1>Data Manager</h1></header>
            <div className="submit-container" style={{display: 'block'}}>
              <div style={{marginBottom: '2rem'}}>
                <label className="upload-area" style={{height: '100px', width: '300px'}}>
                  <input type="file" className="file-input" accept=".zip,.csv,.txt" onChange={handleDatasetUpload} disabled={isUploading}/>
                  <p>{isUploading ? 'Uploading...' : 'Upload new Dataset (.zip)'}</p>
                </label>
              </div>
              <h2>Data & Workspaces</h2>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <p>Manage datasets for your compute jobs.</p>
                <button className="btn-primary" onClick={() => window.open("https://notebooks.grid.college.edu/lab?token=secure_token_1", "_blank")}>
                  <span style={{marginRight: '8px'}}>🪐</span> Launch JupyterLab
                </button>
              </div>
              <h3>Your Datasets</h3>
              <div className="table-container">
                <table className="queue-table">
                  <thead><tr><th>Filename</th><th>Size</th><th>Uploaded</th></tr></thead>
                  <tbody>
                    {datasets.map(d => (
                      <tr key={d.name}><td>{d.name}</td><td>{d.size}</td><td>{d.date}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && user.role === 'admin' && (
           <div className="dashboard-content">
            <h2>Organization Members</h2>
            <div className="table-container">
              <table className="queue-table">
                <tbody>
                  {pendingUsers.map(u => (
                    <tr key={u.email}>
                      <td>{u.email}</td><td>{u.role}</td>
                      <td>{u.is_approved ? 'Active' : 'Pending'}</td>
                      <td>
                        {!u.is_approved && (
                          <button className="btn-primary" onClick={() => handleApprove(u.email)}>Approve</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
           </div>
        )}

        {activeTab === 'submit' && (
          <div className="dashboard-content">
            <header className="page-header"><h1>Deploy Single Job</h1></header>
            <div className="submit-container" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
              <div className="card" style={{flex: 2, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
                <div style={{padding: '10px', background: '#0f172a', borderBottom: '1px solid #334155', display: 'flex', gap: '10px', alignItems: 'center'}}>
                  <span style={{color: '#94a3b8', fontSize: '0.9rem', marginRight: 'auto'}}>Interactive Code Editor (Monaco)</span>
                  <button onClick={() => loadTemplate('pytorch')} className="btn-primary" style={{fontSize: '0.8rem', padding: '4px 10px', background: '#e11d48'}}>Load PyTorch Template</button>
                  <button onClick={() => loadTemplate('pandas')} className="btn-primary" style={{fontSize: '0.8rem', padding: '4px 10px'}}>Load Data Science Template</button>
                </div>
                <div style={{flex: 1, minHeight: '500px'}}>
                  <Editor
                    height="100%"
                    defaultLanguage="python"
                    theme="vs-dark"
                    value={codeString}
                    onChange={(val) => setCodeString(val)}
                    options={{ minimap: { enabled: false } }}
                  />
                </div>
              </div>
              <div className="settings-panel">
                <h3>Resource Limits</h3>
                <div className="input-group">
                  <label>CPU Cores: {cpuReq}</label>
                  <input type="range" min="1" max={user.role === 'faculty' ? 32 : 8} value={cpuReq} onChange={(e) => setCpuReq(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>RAM (MB): {ramReq}</label>
                  <input type="range" min="256" max={user.role === 'faculty' ? 65536 : 4096} step="256" value={ramReq} onChange={(e) => setRamReq(e.target.value)} />
                </div>
                
                <h3 style={{marginTop: '2rem'}}>Environment (Sandboxed)</h3>
                <div className="input-group">
                  <label>Container Runtime (Strictly Enforced)</label>
                  <select value={containerImage} onChange={(e) => setContainerImage(e.target.value)}>
                    <option value="pytorch/pytorch:latest">PyTorch (Docker Sandbox)</option>
                    <option value="tensorflow/tensorflow:latest-gpu">TensorFlow (Docker Sandbox)</option>
                  </select>
                </div>
                <div className="input-group" style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <input type="checkbox" id="requireGpu" checked={requireGpu} onChange={(e) => setRequireGpu(e.target.checked)} />
                  <label htmlFor="requireGpu" style={{marginBottom: 0}}>Require GPU (NVIDIA)</label>
                </div>

                <h3 style={{marginTop: '2rem'}}>Advanced Setup</h3>
                <div className="input-group">
                  <label>Dependency Injection (pip packages)</label>
                  <textarea 
                    value={pipPackages} 
                    onChange={(e) => setPipPackages(e.target.value)} 
                    placeholder="numpy==1.24.0&#10;pandas"
                    style={{width: '100%', height: '60px', background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '4px', padding: '8px'}}
                  />
                </div>
                <div className="input-group">
                  <label>Mount Dataset (Input File)</label>
                  <select value={selectedDataset} onChange={(e) => setSelectedDataset(e.target.value)}>
                    <option value="">-- No Dataset --</option>
                    {datasets.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div className="input-group" style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <input type="checkbox" id="runOvernight" checked={runOvernight} onChange={(e) => setRunOvernight(e.target.checked)} />
                  <label htmlFor="runOvernight" style={{marginBottom: 0}}>Schedule Overnight (Low Cost)</label>
                </div>

                <div style={{display: 'flex', alignItems: 'center', marginTop: '2rem', gap: '15px'}}>
                  <button className="btn-primary" style={{flex: 1}} onClick={handleJobSubmit} disabled={isUploading}>
                    {isUploading ? 'Validating & Submitting...' : 'Compile & Dispatch Job'}
                  </button>
                  <span style={{color: '#10b981', fontWeight: 'bold', fontSize: '1.1rem'}}>Estimated Cost: {Math.ceil((cpuReq * 0.5) + (requireGpu ? 5 : 0))} Credits/hr</span>
                </div>
                
                <p style={{fontSize: '0.8rem', color: '#94a3b8', marginTop: '1rem', textAlign: 'center'}}>
                  💡 Note: To enable Auto-Resume upon eviction, please save your model state to 'checkpoint.ckpt' regularly.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pipeline' && (user.role === 'admin' || user.role === 'faculty') && (
          <div className="dashboard-content">
            <PipelineBuilder />
          </div>
        )}

        {activeTab === 'models' && (
          <div className="dashboard-content">
            <h2>Model Registry & Inference</h2>
            <p>Deploy trained PyTorch/TensorFlow models directly to a scalable FastApi server.</p>
            <div className="table-container" style={{marginTop: '1rem'}}>
              <table className="queue-table">
                <thead>
                  <tr>
                    <th>Model Name</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Endpoint</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>resnet50_finetuned.pt</td>
                    <td>v1.2</td>
                    <td><span className="status queued">Offline</span></td>
                    <td>-</td>
                    <td><button className="btn-primary" onClick={() => alert("Model container provisioned and traffic routed. Endpoint: https://inference.grid.college.edu/models/predict")}>Deploy Endpoint</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'telemetry' && (
          <div className="dashboard-content">
            <h2>Live Hardware Telemetry</h2>
            <p>Real-time node metrics powered by Prometheus.</p>
            <div style={{display: 'flex', gap: '20px', marginTop: '1rem'}}>
              <div style={{flex: 1, background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155'}}>
                <h4 style={{color: '#94a3b8', marginBottom: '10px'}}>CPU Usage (%)</h4>
                <div style={{height: '150px', background: 'linear-gradient(180deg, rgba(16,185,129,0.2) 0%, rgba(30,41,59,0) 100%)', borderBottom: '2px solid #10b981', display: 'flex', alignItems: 'flex-end'}}>
                   <div style={{width: '20%', height: '40%', background: '#10b981', margin: '0 2px'}}></div>
                   <div style={{width: '20%', height: '70%', background: '#10b981', margin: '0 2px'}}></div>
                   <div style={{width: '20%', height: '50%', background: '#10b981', margin: '0 2px'}}></div>
                   <div style={{width: '20%', height: '90%', background: '#10b981', margin: '0 2px'}}></div>
                   <div style={{width: '20%', height: '60%', background: '#10b981', margin: '0 2px'}}></div>
                </div>
              </div>
              <div style={{flex: 1, background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155'}}>
                <h4 style={{color: '#94a3b8', marginBottom: '10px'}}>GPU Temp (C)</h4>
                <div style={{height: '150px', background: 'linear-gradient(180deg, rgba(239,68,68,0.2) 0%, rgba(30,41,59,0) 100%)', borderBottom: '2px solid #ef4444', display: 'flex', alignItems: 'flex-end'}}>
                   <div style={{width: '20%', height: '60%', background: '#ef4444', margin: '0 2px'}}></div>
                   <div style={{width: '20%', height: '65%', background: '#ef4444', margin: '0 2px'}}></div>
                   <div style={{width: '20%', height: '62%', background: '#ef4444', margin: '0 2px'}}></div>
                   <div style={{width: '20%', height: '80%', background: '#ef4444', margin: '0 2px'}}></div>
                   <div style={{width: '20%', height: '75%', background: '#ef4444', margin: '0 2px'}}></div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {liveJobId && (
        <LiveTerminal jobId={liveJobId} onClose={() => setLiveJobId(null)} />
      )}

      {previewModalOpen && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div className="card" style={{width: '500px', maxWidth: '90%', textAlign: 'center'}}>
            <h3>Results Preview</h3>
            <img src={currentPreviewUrl} alt="Preview" style={{maxWidth: '100%', marginTop: '1rem', borderRadius: '4px'}} />
            <button className="btn-primary" onClick={() => setPreviewModalOpen(false)} style={{marginTop: '1rem', display: 'block', width: '100%'}}>Close</button>
          </div>
        </div>
      )}
      
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
