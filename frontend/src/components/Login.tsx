import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface LoginProps {
    onLogin: (username: string, token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isRegistering) {
                // Регистрация
                await axios.post(`${API_URL}/register`, {
                    username,
                    email,
                    password
                });
            }
            
            // Вход
            const response = await axios.post(`${API_URL}/token`, 
                `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    withCredentials: true
                }
            );
            const token = response.data.access_token;
            localStorage.setItem('token', token);
            onLogin(username, token);
        } catch (error) {
            console.error('Login error:', error);
            setError(isRegistering ? 'Ошибка при регистрации' : 'Неверное имя пользователя или пароль');
        }
    };

    return (
        <div className="login-container">
            <h2>{isRegistering ? 'Регистрация' : 'Вход в систему'}</h2>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                    <label htmlFor="username">Имя пользователя:</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                {isRegistering && (
                    <div className="form-group">
                        <label htmlFor="email">Email:</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                )}
                <div className="form-group">
                    <label htmlFor="password">Пароль:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit">
                    {isRegistering ? 'Зарегистрироваться' : 'Войти'}
                </button>
                <button 
                    type="button" 
                    className="switch-form-button"
                    onClick={() => {
                        setIsRegistering(!isRegistering);
                        setError('');
                    }}
                >
                    {isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                </button>
            </form>
        </div>
    );
};

export default Login; 