// Конфигурация API
export const API_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8000'
    : 'https://150.241.101.108:8000';

// Конфигурация WebSocket
export const WS_URL = process.env.NODE_ENV === 'development'
    ? 'ws://localhost:8000'
    : 'wss://150.241.101.108:8000'; 