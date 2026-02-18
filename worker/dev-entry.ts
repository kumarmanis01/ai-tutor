import 'dotenv/config';
import './bootstrap';

// bootstrap.ts registers the worker and starts it when imported in CLI-style.
// If bootstrap exports a function, ensure it runs on import; otherwise, import triggers existing CLI behaviour.
