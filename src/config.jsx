const config = {
  // ✅ Automatically switches between development and production
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
};

export default config;