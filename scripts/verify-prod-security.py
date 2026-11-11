import urllib.request
import hmac
import hashlib

url = 'https://get-one-line.vercel.app/api/whatsapp-webhook'
payload = b'{"object":"whatsapp_business_account","entry":[]}'

secret = ''
with open('.env.local') as f:
    for line in f:
        if line.startswith('WHATSAPP_APP_SECRET='):
            secret = line.split('=', 1)[1].strip()

sig = 'sha256=' + hmac.new(secret.encode('utf-8'), payload, hashlib.sha256).hexdigest()

# 1. Missing signature test
req1 = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
try:
    with urllib.request.urlopen(req1) as r1:
        print('Missing signature:', r1.status)
except urllib.error.HTTPError as e:
    print('1. Missing signature rejected (HTTP):', e.code)

# 2. Invalid signature test
req2 = urllib.request.Request(url, data=payload, headers={
    'Content-Type': 'application/json',
    'x-hub-signature-256': 'sha256=badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb'
}, method='POST')
try:
    with urllib.request.urlopen(req2) as r2:
        print('Invalid signature:', r2.status)
except urllib.error.HTTPError as e:
    print('2. Invalid signature rejected (HTTP):', e.code)

# 3. Valid signature test
req3 = urllib.request.Request(url, data=payload, headers={
    'Content-Type': 'application/json',
    'x-hub-signature-256': sig
}, method='POST')
try:
    with urllib.request.urlopen(req3) as r3:
        print('3. Valid signature accepted (HTTP):', r3.status, r3.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('3. Valid signature failed (HTTP):', e.code, e.read().decode('utf-8'))
