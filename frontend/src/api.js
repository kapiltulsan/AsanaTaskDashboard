import axios from 'axios';

// The FastAPI backend will run on port 8000 by default locally.
const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
