import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useTheme } from './theme.js';
import App from './App.jsx';
import './index.css';

// Performans modunda Framer Motion dönüşüm/yerleşim animasyonlarını tamamen kapatır
function Root() {
  const perf = useTheme(s => s.perf);
  return <MotionConfig reducedMotion={perf ? 'always' : 'user'}><BrowserRouter><App /></BrowserRouter></MotionConfig>;
}

createRoot(document.getElementById('root')).render(<Root />);
