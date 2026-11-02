const dgram = require('dgram');
const net = require('net');
const os = require('os');

const DISCOVERY_PORT = 31980;

function ipNumber(ip) {
  return ip.split('.').reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
}

function hostAddress(remoteAddress) {
  const remote = remoteAddress.replace(/^::ffff:/, '');
  if (!net.isIPv4(remote)) return null;
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs || []) {
      if (addr.family !== 'IPv4' || addr.internal || !addr.netmask) continue;
      const mask = ipNumber(addr.netmask);
      if ((ipNumber(addr.address) & mask) === (ipNumber(remote) & mask)) return addr.address;
    }
  }
  return null;
}

function startDiscovery(getPort) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  socket.on('message', (message, remote) => {
    if (message.toString() !== 'PHANTOMPAD_DISCOVER') return;
    const ip = hostAddress(remote.address);
    if (!ip) return;
    const response = Buffer.from(JSON.stringify({ app: 'PhantomPad', name: os.hostname(), ip, port: getPort() }));
    socket.send(response, remote.port, remote.address);
  });
  socket.on('error', (error) => console.warn('PhantomPad discovery stopped:', error.message));
  socket.bind(DISCOVERY_PORT, '0.0.0.0');
  return () => { try { socket.close(); } catch (_) {} };
}

module.exports = { startDiscovery, DISCOVERY_PORT };
