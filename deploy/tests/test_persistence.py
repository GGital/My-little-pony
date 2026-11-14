"""Offline unit tests for deploy/persistence_check.py (the network is mocked). TEST-L5-09.

Run (repository root):  python3 -m unittest discover -s deploy/tests -p 'test_*.py'

Lab 5 Episode 8 (C-05): one record created on the live URL must still be there after a restart, a rollback to
release A and a roll-forward to release B. The check reads only public endpoints, so it needs no password.

Covers: the record is present and the expected release is running; a missing record fails; a record whose title
changed fails; another running release fails; without an expected commit the running commit is only printed.
"""
import importlib.util
import io
from pathlib import Path
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location('persistence', Path(__file__).parents[1] / 'persistence_check.py')
persistence = importlib.util.module_from_spec(spec)
spec.loader.exec_module(persistence)

A = 'a' * 40
B = 'b' * 40
TITLE = 'L5-8 persistence check'


def live(event=b'{"id":42,"title":"L5-8 persistence check"}', commit=A):
    def respond(base, path, **kwargs):
        if path == '/api/events/42':
            if event is None:
                raise urllib.error.HTTPError(base + path, 404, 'Not Found', None, None)
            return event
        if path == '/api/version':
            return ('{"commit":"%s"}' % commit).encode()
        raise AssertionError('unexpected request ' + path)
    return respond


class PersistenceTests(unittest.TestCase):
    def run_check(self, *args):
        out = io.StringIO()
        with redirect_stdout(out):
            persistence.check('https://demo.test', *args)
        return out.getvalue()

    def test_record_present_and_expected_release_running(self):
        with patch.object(persistence, 'request', side_effect=live()):
            out = self.run_check(42, TITLE, A)
        self.assertIn('PASS event 42 "L5-8 persistence check" is present', out)
        self.assertIn('PASS running commit ' + A, out)

    def test_missing_record_fails(self):
        with patch.object(persistence, 'request', side_effect=live(event=None)):
            with self.assertRaisesRegex(RuntimeError, 'event 42'):
                self.run_check(42, TITLE, A)

    def test_changed_title_fails(self):
        with patch.object(persistence, 'request', side_effect=live(event=b'{"id":42,"title":"Something else"}')):
            with self.assertRaisesRegex(RuntimeError, 'event 42'):
                self.run_check(42, TITLE, A)

    def test_another_running_release_fails(self):
        with patch.object(persistence, 'request', side_effect=live(commit=B)):
            with self.assertRaisesRegex(RuntimeError, '/api/version'):
                self.run_check(42, TITLE, A)

    def test_without_expected_commit_the_running_commit_is_printed(self):
        with patch.object(persistence, 'request', side_effect=live(commit=B)):
            out = self.run_check(42, TITLE)
        self.assertIn('PASS running commit ' + B, out)


if __name__ == '__main__':
    unittest.main()
