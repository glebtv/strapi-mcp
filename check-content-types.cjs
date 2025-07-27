const { spawn } = require('child_process');

// Run the MCP tool to list content types
const mcp = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    STRAPI_URL: 'http://localhost:1337',
    STRAPI_API_TOKEN: require('./test-tokens.json').fullAccessToken
  }
});

// Send the list_content_types command
const request = {
  jsonrpc: '2.0',
  method: 'tools/call',
  params: {
    name: 'list_content_types',
    arguments: {}
  },
  id: 1
};

mcp.stdin.write(JSON.stringify(request) + '\n');

let output = '';
mcp.stdout.on('data', (data) => {
  output += data;
  // Try to parse each line
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        if (response.result) {
          console.log('Content Types:', JSON.stringify(response.result, null, 2));
          mcp.kill();
        }
      } catch (e) {
        // Not a complete JSON line yet
      }
    }
  }
});

mcp.stderr.on('data', (data) => {
  console.error('MCP Error:', data.toString());
});

mcp.on('close', (code) => {
  if (code !== 0) {
    console.log('MCP process exited with code', code);
  }
});