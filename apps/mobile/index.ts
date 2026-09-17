import { registerRootComponent } from 'expo';

import App from './App';

// Expo entry point: registerRootComponent подключает корневой компонент так, чтобы
// приложение одинаково запускалось в dev-client, production build и web preview.
registerRootComponent(App);
