// Конфигурация API
export const API_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8000'
    : 'http://150.241.101.108:8000';  // В продакшене используем полный URL

// Конфигурация WebSocket
export const WS_URL = process.env.NODE_ENV === 'development'
    ? 'ws://localhost:8000'
    : 'ws://150.241.101.108:8000';  // В продакшене используем полный URL 