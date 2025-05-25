import { useState, useEffect } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';
import axios from 'axios';
import { API_URL } from './config';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      // Проверяем валидность токена
      axios.get(`${API_URL}/friends`, {
        headers: {
          'Authorization': `Bearer ${savedToken}`
        }
      }).then(() => {
        // Если запрос успешен, значит токен валиден
        const decodedToken = JSON.parse(atob(savedToken.split('.')[1]));
        setUsername(decodedToken.sub);
        setToken(savedToken);
        setIsLoggedIn(true);
      }).catch(() => {
        // Если токен невалиден, удаляем его
        localStorage.removeItem('token');
      });
    }
  }, []);

  const handleLogin = (username: string, token: string) => {
    setUsername(username);
    setToken(token);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_URL}/logout`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        withCredentials: true
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setUsername('');
    setToken('');
  };

  return (
    <div className="app">
      {!isLoggedIn ? (
        <Login onLogin={handleLogin} />
      ) : (
        <div>
          <div className="header">
            <h1>Чат</h1>
            <div className="user-info">
              <span>Пользователь: {username}</span>
              <button onClick={handleLogout}>Выйти</button>
            </div>
          </div>
          <Chat username={username} token={token} />
        </div>
      )}
    </div>
  );
}

export default App;
