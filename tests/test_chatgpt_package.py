import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('package_chatgpt', root / 'scripts/package-chatgpt.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PackageTests(unittest.TestCase):
    def test_owner_package_contains_no_secrets_or_admin_connection(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = module.build('aim4price-chatgpt-public', 'https://www.aim4price.com', Path(tmp)/'plugin.zip')
            with ZipFile(output) as z:
                self.assertEqual(set(z.namelist()), {'plugin.json','mcp.json','assets/logo.png'})
                mcp = json.loads(z.read('mcp.json'))['mcpServers']['aim4price']
                auth = mcp['extensions']['com.openai']['auth']
                self.assertEqual(auth['baseScopes'], ['aim4price:read'])
                self.assertEqual(auth['client']['mode'], 'provided')
                self.assertEqual(auth['resource'], mcp['url'])
                self.assertNotIn('clientSecret', auth['client'])
                self.assertNotIn('/admin/', z.read('mcp.json').decode())
                self.assertTrue(z.read('assets/logo.png').startswith(b'\x89PNG'))
                manifest = json.loads(z.read('plugin.json'))
                self.assertEqual(manifest['extensions']['com.openai']['publication']['countries'], ['ZA'])
    def test_reject_bad_origin_and_client_id(self):
        for origin in ['http://www.aim4price.com','https://evil.test','https://www.aim4price.com/extra','https://user@www.aim4price.com']:
            with self.assertRaises(ValueError): module.build('valid-id', origin, 'unused.zip')
        with self.assertRaises(ValueError): module.build('bad id', 'https://www.aim4price.com', 'unused.zip')

if __name__ == '__main__': unittest.main()
