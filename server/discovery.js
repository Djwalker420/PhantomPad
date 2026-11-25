const dgram = require('dgram');
const net = require('net');
const os = require('os');

const DISCOVERY_PORT = 31980;

function ipNumber(ip) {
  return ip.split('.').reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
}

function getInterfaceInfo(remoteAddress) {
  const remote = remoteAddress.replace(/^::ffff:/, '');
  if (!net.isIPv4(remote)) return null;
  if (remote === '127.0.0.1') {
    return { ip: '127.0.0.1', isUsb: true };
  }
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs || []) {
      if (addr.family !== 'IPv4' || addr.internal || !addr.netmask) continue;
      const mask = ipNumber(addr.netmask);
      if ((ipNumber(addr.address) & mask) === (ipNumber(remote) & mask)) {
        const n = name.toLowerCase();
        const isUsb = n.includes('usb') || n.includes('rndis') || n.includes('tether') ||
                      n.includes('ncm') || n.includes('gadget') || n.includes('apple mobile device') ||
                      addr.address.startsWith('192.168.42.');
        return { ip: addr.address, isUsb };
      }
    }
  }
  return null;
}

function isUsbConnection(remoteAddress) {
  const info = getInterfaceInfo(remoteAddress);
  return Boolean(info?.isUsb);
}

function hostAddress(remoteAddress) {
  const info = getInterfaceInfo(remoteAddress);
  return info?.ip || null;
}

function startDiscovery(getPort) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  socket.on('message', (message, remote) => {
    if (message.toString() !== 'PHANTOMPAD_DISCOVER') return;
    const info = getInterfaceInfo(remote.address);
    if (!info) return;
    const response = Buffer.from(JSON.stringify({
      app: 'PhantomPad',
      name: os.hostname(),
      ip: info.ip,
      port: getPort(),
      isUsb: info.isUsb
    }));
    socket.send(response, remote.port, remote.address);
  });
  socket.on('error', (error) => console.warn('PhantomPad discovery stopped:', error.message));
  socket.bind(DISCOVERY_PORT, '0.0.0.0');
  return () => { try { socket.close(); } catch (_) {} };
}

module.exports = { startDiscovery, isUsbConnection, DISCOVERY_PORT };
