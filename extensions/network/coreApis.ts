import os from 'os';

// Virtual interface patterns to exclude
const VIRTUAL_PATTERNS = [
    /virtualbox/i,
    /vmware/i,
    /docker/i,
    /veth/i,
    /br-/i,
    /virbr/i,
    /vbox/i,
    /hyper-v/i,
    /vpn/i,
    /tun/i,
    /tap/i,
    /loopback/i,
    /pseudo/i,
    /virtual/i,
    /WSL/i,
];

// Good interface name patterns (WiFi, Ethernet, LAN)
const GOOD_PATTERNS = [
    /wi-?fi/i,
    /wlan/i,
    /wireless/i,
    /ethernet/i,
    /eth\d/i,
    /en\d/i,
    /lan/i,
];

interface NetworkAddress {
    ip: string;
    interface: string;
    family: string;
    internal: boolean;
    priority: number;
}

function isVirtualInterface(name: string): boolean {
    return VIRTUAL_PATTERNS.some(pattern => pattern.test(name));
}

function isGoodInterface(name: string): boolean {
    return GOOD_PATTERNS.some(pattern => pattern.test(name));
}

function calculatePriority(ip: string, interfaceName: string): number {
    let priority = 0;
    
    // Highest priority: 192.168.x.x addresses
    if (ip.startsWith('192.168.')) {
        priority += 100;
    }
    // Also good: 10.x.x.x private networks
    else if (ip.startsWith('10.')) {
        priority += 80;
    }
    // 172.16-31.x.x private networks
    else if (ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        priority += 70;
    }
    
    // Bonus for good interface names (WiFi, Ethernet)
    if (isGoodInterface(interfaceName)) {
        priority += 50;
    }
    
    // Penalty for virtual interfaces
    if (isVirtualInterface(interfaceName)) {
        priority -= 200;
    }
    
    return priority;
}

function getBestNetworkAddress(): NetworkAddress | null {
    const interfaces = os.networkInterfaces();
    const candidates: NetworkAddress[] = [];
    
    for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs) continue;
        
        for (const addr of addrs) {
            // Skip internal (loopback) and IPv6
            if (addr.internal) continue;
            if (addr.family !== 'IPv4') continue;
            
            // Skip virtual interfaces entirely
            if (isVirtualInterface(name)) continue;
            
            const priority = calculatePriority(addr.address, name);
            
            candidates.push({
                ip: addr.address,
                interface: name,
                family: addr.family,
                internal: addr.internal,
                priority
            });
        }
    }
    
    // Sort by priority (highest first)
    candidates.sort((a, b) => b.priority - a.priority);
    
    return candidates.length > 0 ? candidates[0] : null;
}

export default (app, context) => {
    // GET /api/core/v1/netaddr/vento - Returns best network address for Vento client connection
    app.get('/api/core/v1/netaddr/vento', async (req, res) => {
        try {
            const best = getBestNetworkAddress();
            
            if (!best) {
                return res.status(404).json({
                    error: 'No suitable network interface found',
                    fallback: 'localhost'
                });
            }
            
            // Build the full URL for the Vento client APK
            const protocol = req.protocol || 'http';
            const port = req.get('host')?.split(':')[1] || '8000';
            const baseUrl = `${protocol}://${best.ip}:${port}`;
            const apkUrl = `${baseUrl}/public/clients/vento-client.apk`;
            
            res.json({
                ip: best.ip,
                interface: best.interface,
                baseUrl,
                apkUrl,
                priority: best.priority
            });
        } catch (err) {
            console.error('Error getting network address:', err);
            res.status(500).json({
                error: 'Failed to get network address',
                message: err.message
            });
        }
    });
}

