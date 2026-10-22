const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TRUST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

class DeviceTrustStore {
  constructor(filePath, now = Date.now) {
    this.filePath = filePath;
    this.now = now;
    this.devices = new Map();
    this.load();
  }

  load() {
    try {
      const stored = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (!stored || stored.version !== 1 || !Array.isArray(stored.devices)) return;
      for (const record of stored.devices) {
        if (!record || !/^[a-f0-9]{64}$/.test(record.deviceId) ||
            typeof record.publicKey !== 'string' || !Number.isFinite(record.expiresAt)) continue;
        try {
          const key = this.parsePublicKey(record.publicKey);
          if (this.deviceIdFor(key.der) !== record.deviceId) continue;
          this.devices.set(record.deviceId, {
            deviceId: record.deviceId,
            publicKey: record.publicKey,
            createdAt: Number.isFinite(record.createdAt) ? record.createdAt : this.now(),
            lastSeenAt: Number.isFinite(record.lastSeenAt) ? record.lastSeenAt : this.now(),
            expiresAt: record.expiresAt
          });
        } catch (_) {
          // Ignore invalid or corrupted records rather than preventing startup.
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('Failed to load trusted devices:', error.message);
    }
  }

  parsePublicKey(encoded) {
    if (typeof encoded !== 'string' || encoded.length > 4096 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      throw new Error('Invalid device public key');
    }
    const der = Buffer.from(encoded, 'base64');
    if (!der.length || der.toString('base64') !== encoded) throw new Error('Invalid device public key');
    const key = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
      throw new Error('Device key must use P-256');
    }
    return { der, key };
  }

  deviceIdFor(publicKeyDer) {
    return crypto.createHash('sha256').update(publicKeyDer).digest('hex');
  }

  add(publicKeyBase64) {
    const parsed = this.parsePublicKey(publicKeyBase64);
    const deviceId = this.deviceIdFor(parsed.der);
    const now = this.now();
    const record = {
      deviceId,
      publicKey: parsed.der.toString('base64'),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + TRUST_WINDOW_MS
    };
    this.devices.set(deviceId, record);
    this.save();
    return record;
  }

  getActive(deviceId) {
    if (typeof deviceId !== 'string' || !/^[a-f0-9]{64}$/.test(deviceId)) return null;
    const record = this.devices.get(deviceId);
    if (!record) return null;
    if (record.expiresAt <= this.now()) {
      this.devices.delete(deviceId);
      this.save();
      return null;
    }
    try {
      return { record, publicKey: this.parsePublicKey(record.publicKey).key };
    } catch (_) {
      this.devices.delete(deviceId);
      this.save();
      return null;
    }
  }

  renew(deviceId) {
    const active = this.getActive(deviceId);
    if (!active) return null;
    const now = this.now();
    active.record.lastSeenAt = now;
    active.record.expiresAt = now + TRUST_WINDOW_MS;
    this.save();
    return active.record;
  }

  verify(deviceId, challenge, signature) {
    const active = this.getActive(deviceId);
    if (!active || typeof challenge !== 'string' || typeof signature !== 'string') return false;
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(challenge) || !/^[A-Za-z0-9_-]{80,100}$/.test(signature)) return false;
    try {
      const challengeBytes = Buffer.from(challenge, 'base64url');
      const signatureBytes = Buffer.from(signature, 'base64url');
      return challengeBytes.length === 32 && signatureBytes.length >= 64 && signatureBytes.length <= 80 &&
        crypto.verify('sha256', challengeBytes, active.publicKey, signatureBytes);
    } catch (_) {
      return false;
    }
  }

  revoke(deviceId) {
    if (typeof deviceId !== 'string' || !/^[a-f0-9]{64}$/.test(deviceId)) return false;
    const removed = this.devices.delete(deviceId);
    if (removed) this.save();
    return removed;
  }

  list() {
    const now = this.now();
    let changed = false;
    for (const [deviceId, record] of this.devices) {
      if (record.expiresAt <= now) {
        this.devices.delete(deviceId);
        changed = true;
      }
    }
    if (changed) this.save();
    return [...this.devices.values()]
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .map(({ deviceId, createdAt, lastSeenAt, expiresAt }) => ({ deviceId, createdAt, lastSeenAt, expiresAt }));
  }

  save() {
    const temporaryPath = `${this.filePath}.tmp`;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(temporaryPath, JSON.stringify({ version: 1, devices: [...this.devices.values()] }, null, 2), { mode: 0o600 });
    fs.renameSync(temporaryPath, this.filePath);
  }
}

module.exports = { DeviceTrustStore, TRUST_WINDOW_MS };
