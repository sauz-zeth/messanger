// Конфигурация API
export const API_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8000'
    : '/api';  // В продакшене используем относительный путь через nginx

// Конфигурация WebSocket
export const WS_URL = process.env.NODE_ENV === 'development'
    ? 'ws://localhost:8000'
    : `ws://${window.location.host}/ws`;  // В продакшене используем текущий хост через nginx 