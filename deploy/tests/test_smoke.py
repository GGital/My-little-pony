"""Offline unit tests for deploy/smoke_test.py (the network is mocked).

Run (repository root):  python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'
CI runs it too (.github/workflows/ci-docker.yml). Adapted from the Lab 5 Starter Kit for /api/events and the
cookie session.

Covers: public checks pass and sign-in is skipped without credentials; an empty event list still passes; a
database that is not ready fails even if HTTP answers; the session is signed out even when a check fails;
half-set credentials are refused.
"""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('smoke', Path(__file__).parents[1] / 'smoke_test.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class SmokeTests(unittest.TestCase):
    def response(self, base, path, data=None, token=None):
        return {
            '/api/health': b'{"status":"ok"}',
            '/api/ready': b'{"status":"ready","db":"connected"}',
            '/': b'<!doctype html><html></html>',
            '/api/events': b'{"items":[{"id":1}]}',
            '/api/auth/me': b'{"user":{"id":1}}',
            '/api/auth/logout': b'',
        }[path]

    @patch.dict('os.environ', {}, clear=True)
    def test_public_checks_pass_and_skip_optional_login(self):
        with patch.object(smoke, 'request', side_effect=self.response) as req, patch.object(smoke, 'login') as login:
            smoke.check('https://demo.test')
            self.assertEqual(req.call_count, 4)
            login.assert_not_called()

    @patch.dict('os.environ', {}, clear=True)
    def test_an_empty_event_list_still_passes(self):
        def empty(base, path, **kwargs):
            return b'{"items":[]}' if path == '/api/events' else self.response(base, path)
        with patch.object(smoke, 'request', side_effect=empty):
            smoke.check('https://demo.test')

    @patch.dict('os.environ', {}, clear=True)
    def test_db_not_ready_fails_even_when_http_responds(self):
        def disconnected(base, path, **kwargs):
            return b'{"status":"not_ready"}' if path == '/api/ready' else self.response(base, path)
        with patch.object(smoke, 'request', side_effect=disconnected), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, '/api/ready'):
                smoke.check('https://demo.test')

    @patch.dict('os.environ', {'SMOKE_EMAIL': 'smoke@example.test', 'SMOKE_PASSWORD': 'test-only'}, clear=True)
    def test_session_is_signed_out_even_if_me_fails(self):
        def broken_me(base, path, data=None, token=None):
            if path == '/api/auth/me':
                raise ValueError('Broken response')
            return self.response(base, path, data, token)
        with patch.object(smoke, 'request', side_effect=broken_me) as req, \
                patch.object(smoke, 'login', return_value='test-session'):
            with self.assertRaisesRegex(RuntimeError, 'Login smoke'):
                smoke.check('https://demo.test')
            self.assertEqual(req.call_args.args[1], '/api/auth/logout')
            self.assertEqual(req.call_args.kwargs['token'], 'test-session')

    @patch.dict('os.environ', {'SMOKE_EMAIL': 'smoke@example.test'}, clear=True)
    def test_half_set_credentials_are_refused(self):
        with patch.object(smoke, 'request', side_effect=self.response):
            with self.assertRaisesRegex(RuntimeError, 'both'):
                smoke.check('https://demo.test')


if __name__ == '__main__':
    unittest.main()
