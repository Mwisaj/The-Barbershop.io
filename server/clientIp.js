import proxyaddr from 'proxy-addr';
import { isIP } from 'node:net';

export function clientIpResolver(trustedProxies = []) {
  if (!Array.isArray(trustedProxies)) throw new Error('Trusted proxies must be an explicit list of IP addresses or CIDRs.');
  if (trustedProxies.some(value => ['0.0.0.0/0', '::/0'].includes(value))) throw new Error('Trusting the whole internet is not allowed.');
  const trust = proxyaddr.compile(trustedProxies);
  return req => {
    const address = proxyaddr(req, trust);
    if (!isIP(address)) throw Object.assign(new Error('Invalid client address.'), { status: 400 });
    return address.replace(/^::ffff:/, '');
  };
}
