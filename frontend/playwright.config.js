import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./test', timeout:30000, workers:1, reporter:'list',
 use:{baseURL:'http://127.0.0.1:5179',channel:'msedge',headless:true},
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5179 --strictPort',url:'http://127.0.0.1:5179',reuseExistingServer:false},
});
