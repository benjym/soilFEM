import './style.css';
import { createApp } from './app/App';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Missing #app root element.');
}

createApp(root);
