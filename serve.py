#!/usr/bin/env python3
"""
Python server for yappr with proper WASM support and CORS headers.
This serves the built Next.js application with the headers needed for WASM to work.
"""

import http.server
import socketserver
import os
import json
from urllib.parse import urlparse

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class YapprHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def do_GET(self):
        """Handle GET requests with Next.js routing support"""
        parsed_path = urlparse(self.path)
        file_path = parsed_path.path
        
        # Handle Next.js static files from .next/static
        if file_path.startswith('/_next/static/'):
            # Serve static files from .next directory
            self.path = file_path
            return super().do_GET()
        
        # Handle WASM files from dash-wasm directory
        if file_path.startswith('/dash-wasm/'):
            # Serve WASM files with correct headers
            return super().do_GET()
        
        # Handle API routes and other static assets
        if (file_path.startswith('/api/') or 
            file_path.endswith('.js') or 
            file_path.endswith('.css') or 
            file_path.endswith('.png') or 
            file_path.endswith('.jpg') or 
            file_path.endswith('.jpeg') or 
            file_path.endswith('.gif') or 
            file_path.endswith('.svg') or 
            file_path.endswith('.ico') or
            file_path.endswith('.wasm')):
            return super().do_GET()
        
        # For all other routes, serve index.html (SPA routing)
        if os.path.exists(os.path.join(DIRECTORY, 'out', 'index.html')):
            # Production build - serve from out directory
            self.path = '/out/index.html'
        elif os.path.exists(os.path.join(DIRECTORY, '.next')):
            # Development - serve a basic HTML that loads the Next.js dev server
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            html_content = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Yappr</title>
    <script>
        // Redirect to Next.js dev server if this is development
        if (window.location.hostname === 'localhost' && window.location.port === '3000') {
            console.log('Development mode detected - yappr should be served with "npm run dev" on a different port');
            document.body.innerHTML = '<h1>Please run "npm run dev" and use the port it provides</h1>';
        }
    </script>
</head>
<body>
    <div id="root"></div>
</body>
</html>
            """
            self.wfile.write(html_content.encode())
            return
        else:
            # Fallback
            self.send_error(404, "File not found")
            return
    
    def end_headers(self):
        """Add necessary headers for WASM and CORS support"""
        path = self.path.lower()
        
        # Add CORS headers for WASM - these are critical!
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        
        # Set correct content type for WASM files
        if path.endswith('.wasm'):
            self.send_header('Content-Type', 'application/wasm')
            # Cache WASM files
            self.send_header('Cache-Control', 'public, max-age=604800')
        
        # Set correct content type for JS files
        elif path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
        
        # Allow cross-origin requests
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        super().end_headers()

def main():
    # Check if we have a built application
    has_build = os.path.exists(os.path.join(DIRECTORY, 'out')) or os.path.exists(os.path.join(DIRECTORY, '.next'))
    
    print("=" * 60)
    print("🚀 YAPPR PYTHON SERVER")
    print("=" * 60)
    print(f"📁 Serving from: {DIRECTORY}")
    print(f"🌐 Server URL: http://localhost:{PORT}")
    print(f"📦 Build detected: {'Yes' if has_build else 'No'}")
    print()
    print("✅ WASM Headers: Cross-Origin-Embedder-Policy & Cross-Origin-Opener-Policy")
    print("✅ CORS: Enabled for all origins")
    print("✅ Content-Type: Proper WASM and JS content types")
    print()
    
    if not has_build:
        print("⚠️  WARNING: No build detected!")
        print("   Run 'npm run build' to create a production build")
        print("   Or run 'npm run dev' for development mode")
        print()
    
    print("🔗 Open http://localhost:3000 in your browser")
    print("⏹️  Press Ctrl+C to stop the server")
    print("=" * 60)

    with socketserver.TCPServer(("", PORT), YapprHTTPRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n🛑 Server stopped.")

if __name__ == "__main__":
    main()