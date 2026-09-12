import { useState } from 'react';
import { useAuth } from './AuthContext';
import { loginUser, registerUser } from './api';

export default function Login() {
  const { login } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);

    try {
      if (isRegistering) {
        const res = await registerUser(email, password, role);
        setMsg(res.message);
        setIsRegistering(false);
      } else {
        const res = await loginUser(email, password);
        login(res);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{isRegistering ? 'Create Account' : 'Welcome to HTCondor Grid'}</h2>
        <p>Sign in to deploy jobs to the campus supercomputer</p>

        {error && <div className="error-box">{error}</div>}
        {msg && <div className="success-box">{msg}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" required 
              value={email} onChange={(e) => setEmail(e.target.value)} 
              placeholder="student@college.edu"
            />
          </div>
          
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" required 
              value={password} onChange={(e) => setPassword(e.target.value)} 
            />
          </div>

          {isRegistering && (
            <div className="input-group">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="admin">IT Admin</option>
              </select>
            </div>
          )}

          <button type="submit" className="btn-primary">
            {isRegistering ? 'Register' : 'Login'}
          </button>
        </form>

        <p className="toggle-auth" onClick={() => setIsRegistering(!isRegistering)}>
          {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
        </p>
      </div>
    </div>
  );
}
