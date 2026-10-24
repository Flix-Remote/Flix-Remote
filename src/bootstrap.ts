import './style.css';
import { renderOriginalSurface } from './remote-page/bootstrap.ts';

if (!new URLSearchParams(location.search).has('utility')) await renderOriginalSurface();
await import('./main.ts');
