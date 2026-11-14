"""Checks that one record on the live URL survived a restart or a redeploy (Lab 5 Episode 8, C-05).

    python3 deploy/persistence_check.py SERVICE_URL EVENT_ID "TITLE" [EXPECTED_COMMIT]

Reads only public endpoints, so no password is needed:
  GET /api/events/EVENT_ID -> the event still exists with the same title (it lives in Cloud SQL, not the container)
  GET /api/version         -> the running commit; must equal EXPECTED_COMMIT when given (release A or B)
Exits non-zero if either check fails. Offline unit tests: deploy/tests/test_persistence.py
"""
import json
import sys
import urllib.error
import urllib.request


def request(base, path):
    """Returns the response body (bytes). Raises on HTTP errors and timeouts."""
    with urllib.request.urlopen(base + path, timeout=30) as response:
        return response.read()


def check(base, event_id, title, expected_commit=None):
    try:
        event = json.loads(request(base, '/api/events/%s' % event_id))
    except (urllib.error.URLError, TimeoutError, ValueError):
        event = {}
    if event.get('title') != title:
        raise RuntimeError('Record check failed: event %s "%s" is missing or changed' % (event_id, title))
    print('PASS event %s "%s" is present' % (event_id, title))

    commit = json.loads(request(base, '/api/version')).get('commit')
    if expected_commit and commit != expected_commit:
        raise RuntimeError('Release check failed: /api/version reports %s, expected %s' % (commit, expected_commit))
    print('PASS running commit %s' % commit)


if __name__ == '__main__':
    if len(sys.argv) not in (4, 5):
        sys.exit('Usage: python3 deploy/persistence_check.py SERVICE_URL EVENT_ID "TITLE" [EXPECTED_COMMIT]')
    check(sys.argv[1].rstrip('/'), *sys.argv[2:])
