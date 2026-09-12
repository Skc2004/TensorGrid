const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const submitJob = async (file, cpuReq, ramReq, requireGpu, containerImage, codeString, selectedDataset, runOvernight, pipPackages, workspaceId) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role || 'student';
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  } else if (codeString) {
    formData.append('codeString', codeString);
  } else {
    throw new Error('Must provide either a file or code snippet.');
  }
  formData.append('cpu', cpuReq);
  formData.append('ram', ramReq);
  formData.append('gpu', requireGpu);
  formData.append('container', containerImage);
  formData.append('role', role);
  formData.append('workspace_id', workspaceId || 'personal');
  
  if (selectedDataset) formData.append('dataset', selectedDataset);
  if (runOvernight) formData.append('run_overnight', runOvernight);
  if (pipPackages) formData.append('pip_packages', pipPackages);

  const response = await fetch(`${API_URL}/jobs/submit`, {
    method: 'POST',
    headers: getHeaders(), 
    body: formData
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to submit job');
  }
  return response.json();
};

export const submitPipeline = async (dagJson) => {
  const response = await fetch(`${API_URL}/jobs/pipeline`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(dagJson)
  });
  if (!response.ok) throw new Error('Failed to deploy pipeline');
  return response.json();
};

export const fetchJobStatus = async (workspaceId = 'personal') => {
  const response = await fetch(`${API_URL}/jobs/status?workspace_id=${workspaceId}`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch jobs');
  const data = await response.json();
  return data.jobs || [];
};

export const fetchGridMetrics = async () => {
  const response = await fetch(`${API_URL}/grid/metrics`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch metrics');
  const data = await response.json();
  return data.metrics || {};
};

export const fetchGridNodes = async () => {
  const response = await fetch(`${API_URL}/grid/nodes`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch grid nodes');
  const data = await response.json();
  return data.nodes || [];
};

export const fetchAnalytics = async () => {
  const response = await fetch(`${API_URL}/admin/analytics`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch analytics');
  const data = await response.json();
  return data.analytics || { cpu_history: [], department_usage: [] };
};

export const fetchDatasets = async (workspaceId = 'personal') => {
  const response = await fetch(`${API_URL}/dataset/list?workspace_id=${workspaceId}`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch datasets');
  const data = await response.json();
  return data.datasets || [];
};

export const uploadDataset = async (file, workspaceId = 'personal') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('workspace_id', workspaceId);
  const response = await fetch(`${API_URL}/dataset/upload`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData
  });
  if (!response.ok) throw new Error('Failed to upload dataset');
  return response.json();
};

export const fetchJobLogs = async (jobId) => {
  const response = await fetch(`${API_URL}/jobs/logs/${jobId}`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch logs');
  const data = await response.json();
  return data.logs;
};

export const downloadJobResults = (jobId) => {
  window.open(`${API_URL}/jobs/download/${jobId}`, '_blank');
};

export const cancelJob = async (jobId) => {
  const response = await fetch(`${API_URL}/jobs/cancel/${jobId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to cancel job');
};

export const fetchUsers = async () => {
  const response = await fetch(`${API_URL}/admin/users`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch users');
  const data = await response.json();
  return data.users || [];
};

export const approveUser = async (email) => {
  const response = await fetch(`${API_URL}/admin/users/approve/${email}`, {
    method: 'PUT',
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to approve user');
};

export const fetchProfile = async () => {
  const response = await fetch(`${API_URL}/auth/profile`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch profile');
  const data = await response.json();
  return data.profile || {};
};

export const loginUser = async (email, password) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (data.status === 'error') throw new Error(data.message);
  return data;
};

export const registerUser = async (email, password, role) => {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role })
  });
  const data = await response.json();
  if (data.status === 'error') throw new Error(data.message);
  return data;
};

export const validateCode = async (codeString) => {
  const response = await fetch(`${API_URL}/jobs/validate`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ codeString })
  });
  const data = await response.json();
  if (data.status === 'error') throw new Error(data.message);
  return data;
};

export const previewResults = async (jobId) => {
  const response = await fetch(`${API_URL}/jobs/results/preview/${jobId}`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to fetch preview');
  return response.json();
};

export const createCheckoutSession = async (credits) => {
  const response = await fetch(`${API_URL}/checkout`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ credits })
  });
  if (!response.ok) throw new Error('Failed to initiate checkout');
  return response.json();
};
