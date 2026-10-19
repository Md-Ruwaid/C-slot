const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const WEBSITE_DIR = __dirname;
const PROJECT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_DIR, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.exe': 'application/vnd.microsoft.portable-executable'
};

// Locate installer binaries
function getDistFile(targetName) {
  if (!fs.existsSync(DIST_DIR)) return null;
  const files = fs.readdirSync(DIST_DIR);
  
  if (targetName === 'setup') {
    const found = files.find(f => f.toLowerCase().includes('setup') && f.endsWith('.exe'));
    return found ? path.join(DIST_DIR, found) : null;
  }
  
  if (targetName === 'portable') {
    const found = files.find(f => f.toLowerCase().includes('portable') && f.endsWith('.exe'));
    return found ? path.join(DIST_DIR, found) : null;
  }
  
  return null;
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // API endpoint for release metadata
  if (pathname === '/api/info') {
    const setupPath = getDistFile('setup');
    const portablePath = getDistFile('portable');
    
    const info = {
      name: 'C-Slot',
      version: '0.1.0',
      description: 'Minimalist Clipboard Manager for Windows',
      hasLocalSetup: !!setupPath,
      hasLocalPortable: !!portablePath,
      setupSize: setupPath ? fs.statSync(setupPath).size : 111627635,
      portableSize: portablePath ? fs.statSync(portablePath).size : 111418633,
      githubReleaseUrl: 'https://github.com/Md-Ruwaid/Ctrl-slot/releases/latest',
      githubSetupUrl: 'https://github.com/Md-Ruwaid/Ctrl-slot/releases/download/v0.1.0/Ctrl.Slot.Setup.0.1.0.exe',
      githubPortableUrl: 'https://github.com/Md-Ruwaid/Ctrl-slot/releases/download/v0.1.0/Ctrl-Slot-Portable.exe',
      setupSha256: '246D96D7027B145B03812D2FC829854396C0D27652E7C8582CAC84E564526959',
      portableSha256: '91EFAE74F16999FBB1EDD9A508B5B88A41D2F2232A23B6755D9877CA8CCC9A5D'
    };

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify(info, null, 2));
  }

  // File download routes
  if (pathname === '/download/setup' || pathname === '/download/portable') {
    const type = pathname === '/download/setup' ? 'setup' : 'portable';
    const filePath = getDistFile(type);

    if (!filePath || !fs.existsSync(filePath)) {
      // Fallback redirect to GitHub Releases if local binary missing
      const redirectUrl = type === 'setup' 
        ? 'https://github.com/Md-Ruwaid/Ctrl-slot/releases/download/v0.1.0/Ctrl.Slot.Setup.0.1.0.exe'
        : 'https://github.com/Md-Ruwaid/Ctrl-slot/releases/download/v0.1.0/Ctrl-Slot-Portable.exe';
      res.writeHead(302, { 'Location': redirectUrl });
      return res.end();
    }

    const stat = fs.statSync(filePath);
    const fileName = path.basename(filePath);

    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    return;
  }

  // Static file serving from WEBSITE_DIR
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(path.join(WEBSITE_DIR, pathname));
  if (!safePath.startsWith(WEBSITE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });

    fs.createReadStream(safePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 C-Slot Landing & Download Server Running`);
  console.log(`  🔗 Local Web:  http://localhost:${PORT}`);
  console.log(`  📦 Installer:  http://localhost:${PORT}/download/setup`);
  console.log(`  💼 Portable:   http://localhost:${PORT}/download/portable`);
  console.log(`======================================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = PORT + 1;
    console.log(`Port ${PORT} in use, trying ${nextPort}...`);
    server.listen(nextPort);
  } else {
    console.error('Server error:', err);
  }
});
