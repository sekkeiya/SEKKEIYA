const fs = require('fs');
const path = require('path');

const dirs = [
    'src/app/providers',
    'src/features/auth/guards',
    'src/features/search/components',
    'src/shared/config'
];

dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

const moves = [
    { from: 'src/contexts/AuthProvider.jsx', to: 'src/app/providers/AuthProvider.jsx' },
    { from: 'src/pages/RouteGuards.jsx', to: 'src/features/auth/guards/RouteGuards.jsx' },
    { from: 'src/components/SearchBar.jsx', to: 'src/features/search/components/SearchBar.jsx' },
    { from: 'src/config/firebase/config.js', to: 'src/shared/config/firebase.js' },
    { from: 'src/App.jsx', to: 'src/app/App.jsx' }
];

moves.forEach(m => {
    if (fs.existsSync(m.from)) {
        fs.renameSync(m.from, m.to);
        console.log(`Moved ${m.from} to ${m.to}`);
    } else {
        console.log(`Path not found: ${m.from}`);
    }
});
