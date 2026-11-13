"""Public deployment checks for TCG Event Hub. Credentials and session cookies are never printed.

Adapted from the Lab 5 Starter Kit. Called by .github/workflows/deploy.yml after every deployment:
    python3 deploy/smoke_test.py SERVICE_URL
It exits non-zero (failing the workflow) if any check fails. Each public check is retried up to 5 times,
3 seconds apart, to tolerate Cloud Run cold starts.

Checks, in order (all read-only):
  1. GET /api/health  -> {"status": "ok"}
  2. GET /api/ready   -> {"db": "connected"}            (the database answers)
  3. GET /            -> an HTML page                   (the built React app is served, SD-01)
  4. GET /api/events  -> {"items": [...]}               (migrations ran and the event query works)
     GET /api/version -> {"commit": EXPECTED_COMMIT}    (only when EXPECTED_COMMIT is set; deploy.yml sets it)
  5. OPTIONAL sign-in -> login, /api/auth/me, logout. Runs only when BOTH SMOKE_EMAIL and SMOKE_PASSWORD are set.
     Use a dedicated low-role participant, never a demo account the partner team uses.
     The session is always signed out, even when a check fails.

Changes from the kit: /api/events instead of /api/categories; our session is the `tcg.sid` cookie (not a Bearer
token), and POSTs carry an Origin header equal to the service URL (APP_ORIGIN lists it).
Uses only the Python standard library. Offline unit tests: deploy/tests/test_smoke.py
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

SESSION_COOKIE = 'tcg.sid'


def _send(base, path, data=None, token=None):
    headers = {}
    if data is not None:
        headers['Content-Type'] = 'application/json'
        headers['Origin'] = base  # the origin check (SDS §6.1) applies to every POST
    if token:
        headers['Cookie'] = SESSION_COOKIE + '=' + token
    req = urllib.request.Request(base + path, headers=headers,
                                 data=json.dumps(data).encode() if data is not None else None)
    return urllib.request.urlopen(req, timeout=30)


def request(base, path, data=None, token=None):
    """Returns the response body (bytes). Raises on HTTP errors and timeouts."""
    with _send(base, path, data, token) as response:
        return response.read()


def login(base, email, password):
    """Signs in and returns the session cookie value (never printed)."""
    with _send(base, '/api/auth/login', {'email': email, 'password': password}) as response:
        for header in response.headers.get_all('Set-Cookie') or []:
            name, _, rest = header.partition('=')
            if name.strip() == SESSION_COOKIE:
                return rest.split(';', 1)[0]
    raise ValueError('No session cookie')


def check(base):
    checks = [
        ('/api/health', lambda b: json.loads(b).get('status') == 'ok'),
        ('/api/ready', lambda b: json.loads(b).get('db') == 'connected'),
        ('/', lambda b: b'<html' in b.lower()),
        # A list, possibly empty: seeded events are relative to the first seed run and pass with time.
        ('/api/events', lambda b: isinstance(json.loads(b).get('items'), list)),
    ]
    # R-08: deploy.yml sets EXPECTED_COMMIT to the released image tag; the running build must report that commit.
    expected = os.getenv('EXPECTED_COMMIT')
    if expected:
        checks.append(('/api/version', lambda b: json.loads(b).get('commit') == expected))
    for path, predicate in checks:
        for attempt in range(5):
            try:
                if not predicate(request(base, path)):
                    raise ValueError('Unexpected response')
                break
            except (urllib.error.URLError, TimeoutError, ValueError, AttributeError):
                if attempt == 4:
                    raise RuntimeError('Smoke check failed: ' + path) from None
                time.sleep(3)
        print('PASS ' + path)

    email, password = os.getenv('SMOKE_EMAIL'), os.getenv('SMOKE_PASSWORD')
    if bool(email) != bool(password):
        raise RuntimeError('Set both SMOKE_EMAIL and SMOKE_PASSWORD, or neither.')
    if not email:
        print('SKIP login: optional smoke credentials not configured')
        return
    token = None
    try:
        token = login(base, email, password)
        request(base, '/api/auth/me', token=token)
        print('PASS login and authenticated /api/auth/me')
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
        raise RuntimeError('Login smoke check failed') from None
    finally:
        if token:
            request(base, '/api/auth/logout', data={}, token=token)
            print('PASS logout')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 deploy/smoke_test.py SERVICE_URL')
    check(sys.argv[1].rstrip('/'))
