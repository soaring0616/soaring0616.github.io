import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// React 18 的進入點：createRoot 之後把 <App /> 掛到 index.html 的 #root 上。
// StrictMode 只在開發模式生效，會刻意把 effect 跑兩次來抓出沒清乾淨的副作用，
// 這也是 Home / HymnDetail 的 useEffect 都寫了 cancelled 旗標的原因。
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
