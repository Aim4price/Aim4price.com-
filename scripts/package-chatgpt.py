#!/usr/bin/env python3
"""Build the public Owner plugin ZIP. No credentials or production records are read."""
import argparse
import json
from pathlib import Path
import re
from urllib.parse import urlparse
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]

def build(client_id, origin, output):
    if not re.fullmatch(r'[a-zA-Z0-9._-]{1,120}', client_id):
        raise ValueError('A registered OAuth client ID is required (not a secret).')
    url = urlparse(origin)
    if (url.scheme != 'https' or url.netloc not in ('www.aim4price.com', 'aim4price.com')
            or url.path or url.query or url.fragment):
        raise ValueError('Use the exact canonical production Aim4price HTTPS origin without a trailing slash.')
    manifest = json.loads((ROOT / 'integrations/chatgpt/plugin.json').read_text())
    resource = origin + '/api/ai/mcp'
    mcp = {'$schema': 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', 'mcpServers': {
        'aim4price': {'type': 'streamable-http', 'url': resource, 'extensions': {'com.openai': {'auth': {
            'type': 'oauth', 'client': {'mode': 'provided', 'clientId': client_id,
                'tokenEndpointAuthMethod': 'client_secret_basic'},
            'authorizationUrl': origin + '/api/ai/oauth/authorize',
            'tokenUrl': origin + '/api/ai/oauth/token', 'resource': resource,
            'baseScopes': ['aim4price:read']}}}}}}
    # Explicit allowlist: never archive the repository or environment files.
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        archive.writestr('plugin.json', json.dumps(manifest, indent=2) + '\n')
        archive.writestr('mcp.json', json.dumps(mcp, indent=2) + '\n')
        archive.write(ROOT / 'public/icon.png', 'assets/logo.png')
    return output

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client-id', required=True, help='Public identifier matching the registered Owner OAuth client')
    parser.add_argument('--origin', default='https://www.aim4price.com')
    parser.add_argument('--output', default='.next/chatgpt/aim4price.zip')
    args = parser.parse_args()
    print(build(args.client_id, args.origin, args.output))
