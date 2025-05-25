import { useState } from 'react';
import { API_URL } from '../config';

interface AuthProps {
  onAuth: (username: string, token: string) => void;
}

export const Auth = ({ onAuth }: AuthProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = isLogin ? `${API_URL}/token` : `${API_URL}/register`;
      const body = isLogin 
        ? new URLSearchParams({ username, password })
        : JSON.stringify({ username, email, password });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': isLogin ? 'application/x-www-form-urlencoded' : 'application/json',
        },
        body,
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const data = await response.json();
      if (isLogin) {
        onAuth(username, data.access_token);
      } else {
        setIsLogin(true);
        alert('Registration succssful. Please login with your credentials.');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Something went wrong');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
        {isLogin ? 'Login' : 'Register'}
      </h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        
        {!isLogin && (
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
        )}
        
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        
        <button
          type="submit"
          style={{
            padding: '10px',
            backgroundColor: '#3182ce',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {isLogin ? 'Login' : 'Register'}
        </button>
      </form>
      
      <div style={{ textAlign: 'center', marginTop: '15px' }}>
        <button
          onClick={() => setIsLogin(!isLogin)}
          style={{
            background: 'none',
            border: 'none',
            color: '#3182ce',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {isLogin ? 'Need to register?' : 'Already have an account?'}
        </button>
      </div>
    </div>
  );
}; 