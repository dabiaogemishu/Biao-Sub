import { stringify } from 'yaml';
import { cleanObject } from '../core/model.js';
import { nodeToClashProxy } from '../clash/convert.js';

function tlsBlock(node) {
    const reality = node.security === 'reality' || node.reality?.publicKey;
    if (!node.tls && node.security !== 'tls' && !reality) return undefined;
    return cleanObject({
        enabled: true,
        server_name: node.sni || undefined,
        insecure: node.skipCertVerify || undefined,
        alpn: node.alpn?.length ? node.alpn : undefined,
        utls: node.fingerprint ? { enabled: true, fingerprint: node.fingerprint } : undefined,
        reality: reality ? cleanObject({
            enabled: true,
            public_key: node.reality?.publicKey,
            short_id: node.reality?.shortId || undefined
        }) : undefined
    });
}

function singboxTransport(node) {
    if (node.network === 'ws' && node.ws) {
        return cleanObject({
            type: 'ws',
            path: node.ws.path || '/',
            headers: node.ws.host ? { Host: node.ws.host } : undefined
        });
    }
    if (node.network === 'grpc' && node.grpc) {
        return { type: 'grpc', service_name: node.grpc.serviceName || '' };
    }
    if (node.network === 'httpupgrade' && node.httpupgrade) {
        return cleanObject({
            type: 'httpupgrade',
            host: node.httpupgrade.host || undefined,
            path: node.httpupgrade.path || '/'
        });
    }
    if ((node.network === 'http' || node.network === 'h2') && node.http) {
        return cleanObject({
            type: 'http',
            host: node.http.host ? [node.http.host] : undefined,
            path: node.http.path || '/',
            method: node.http.method || undefined
        });
    }
    return undefined;
}

function xrayUser(node) {
    if (node.type === 'vmess') {
        return { id: node.uuid, alterId: node.alterId || 0, security: node.cipher || 'auto' };
    }
    if (node.type === 'vless') {
        return cleanObject({
            id: node.uuid,
            encryption: node.encryption || 'none',
            flow: node.flow || undefined
        });
    }
    return { password: node.password };
}

function xrayStream(node) {
    const security = node.security === 'reality' ? 'reality' : node.tls ? 'tls' : 'none';
    const stream = { network: node.network === 'h2' ? 'http' : (node.network || 'tcp'), security };
    if (node.network === 'ws') {
        stream.wsSettings = cleanObject({ path: node.ws?.path || '/', headers: node.ws?.host ? { Host: node.ws.host } : undefined });
    } else if (node.network === 'grpc') {
        stream.grpcSettings = { serviceName: node.grpc?.serviceName || '' };
    } else if (node.network === 'httpupgrade') {
        stream.network = 'httpupgrade';
        stream.httpupgradeSettings = cleanObject({ path: node.httpupgrade?.path || '/', host: node.httpupgrade?.host || undefined });
    } else if (node.network === 'xhttp') {
        stream.xhttpSettings = cleanObject({
            path: node.xhttp?.path || '/',
            host: node.xhttp?.host || undefined,
            mode: node.xhttp?.mode || 'auto',
            extra: node.xhttp?.extra || undefined
        });
    } else if (node.network === 'kcp') {
        stream.network = 'kcp';
        stream.kcpSettings = cleanObject({
            header: { type: node.kcp?.headerType || 'none' },
            seed: node.kcp?.seed || undefined
        });
    } else if (node.network === 'hysteria') {
        stream.network = 'hysteria';
        const version = Number(node.version);
        const settings = cleanObject({
            version: Number.isInteger(version) && version > 0 ? version : undefined,
            auth: node.auth || undefined,
            up: node.up || undefined,
            down: node.down || undefined
        });
        if (settings) stream.hysteriaSettings = settings;
    } else if (node.network === 'http' || node.network === 'h2') {
        stream.network = 'http';
        stream.httpSettings = cleanObject({ path: node.http?.path || '/', host: node.http?.host ? [node.http.host] : undefined });
    }
    if (security === 'tls') {
        stream.tlsSettings = cleanObject({
            serverName: node.sni || undefined,
            allowInsecure: node.skipCertVerify || undefined,
            fingerprint: node.fingerprint || undefined,
            alpn: node.alpn?.length ? node.alpn : undefined
        });
    } else if (security === 'reality') {
        stream.realitySettings = cleanObject({
            serverName: node.sni || undefined,
            fingerprint: node.fingerprint || undefined,
            publicKey: node.reality?.publicKey,
            shortId: node.reality?.shortId || undefined,
            spiderX: node.reality?.spiderX || undefined
        });
    }
    return stream;
}

function xrayOutbound(node) {
    const protocol = node.type === 'trojan' ? 'trojan' : node.type;
    const settings = protocol === 'trojan'
        ? { servers: [{ address: node.server, port: node.port, password: node.password }] }
        : { vnext: [{ address: node.server, port: node.port, users: [xrayUser(node)] }] };
    return {
        protocol,
        tag: node.name,
        settings,
        streamSettings: xrayStream(node)
    };
}

function useXray(node) {
    return ['vmess', 'vless', 'trojan'].includes(node.type) && ['kcp', 'xhttp', 'hysteria'].includes(node.network);
}

function singboxOutbound(node) {
    const tag = node.name;
    const dial = { server: node.server, server_port: node.port };
    if (node.type === 'wireguard') {
        const addresses = String(node.address || '').split(',').map(item => item.trim()).filter(Boolean);
        const reserved = String(node.reserved || '').split(',').map(item => Number(item.trim())).filter(item => Number.isInteger(item));
        return {
            label: 'sing-box 端点 JSON',
            object: cleanObject({
                type: 'wireguard',
                tag,
                mtu: node.mtu || undefined,
                address: addresses.length ? addresses : undefined,
                private_key: node.privateKey,
                peers: [cleanObject({
                    address: node.server,
                    port: node.port,
                    public_key: node.publicKey,
                    pre_shared_key: node.presharedKey || undefined,
                    allowed_ips: ['0.0.0.0/0', '::/0'],
                    reserved: reserved.length ? reserved : undefined
                })]
            })
        };
    }
    if (node.type === 'ss') {
        return {
            label: 'sing-box 出站 JSON',
            object: cleanObject({
                type: 'shadowsocks', tag, ...dial, method: node.cipher, password: node.password,
                plugin: node.plugin === 'obfs' ? 'obfs-local' : (node.plugin || undefined),
                plugin_opts: node.pluginOpts || undefined
            })
        };
    }
    if (node.type === 'vmess' || node.type === 'vless' || node.type === 'trojan') {
        const base = node.type === 'vmess'
            ? { type: 'vmess', uuid: node.uuid, security: node.cipher || 'auto', alter_id: node.alterId || 0 }
            : node.type === 'vless'
                ? {
                    type: 'vless',
                    uuid: node.uuid,
                    flow: node.flow || undefined,
                    encryption: node.encryption && node.encryption !== 'none' ? node.encryption : undefined
                }
                : { type: 'trojan', password: node.password };
        return {
            label: 'sing-box 出站 JSON',
            object: cleanObject({ ...base, tag, ...dial, tls: tlsBlock(node), transport: singboxTransport(node) })
        };
    }
    if (node.type === 'hysteria2') {
        return {
            label: 'sing-box 出站 JSON',
            object: cleanObject({
                type: 'hysteria2', tag, ...dial, password: node.password,
                obfs: node.obfs ? { type: node.obfs, password: node.obfsPassword || undefined } : undefined,
                tls: tlsBlock({ ...node, tls: true })
            })
        };
    }
    if (node.type === 'hysteria') {
        return {
            label: 'sing-box 出站 JSON',
            object: cleanObject({
                type: 'hysteria', tag, ...dial, auth_str: node.auth || node.password,
                up_mbps: node.up ? Number(node.up) || node.up : undefined,
                down_mbps: node.down ? Number(node.down) || node.down : undefined,
                tls: tlsBlock({ ...node, tls: true })
            })
        };
    }
    if (node.type === 'tuic') {
        return {
            label: 'sing-box 出站 JSON',
            object: cleanObject({
                type: 'tuic', tag, ...dial, uuid: node.uuid || undefined, password: node.password || undefined,
                token: node.token || undefined,
                congestion_control: node.congestion || undefined, udp_relay_mode: node.udpRelayMode || undefined,
                tls: tlsBlock({ ...node, tls: true })
            })
        };
    }
    if (node.type === 'anytls') {
        return {
            label: 'sing-box 出站 JSON',
            object: cleanObject({ type: 'anytls', tag, ...dial, password: node.password, tls: tlsBlock({ ...node, tls: true }) })
        };
    }
    if (node.type === 'socks') {
        return {
            label: 'sing-box 出站 JSON',
            object: cleanObject({
                type: 'socks', tag, ...dial, version: String(node.version || '5'),
                username: node.username || undefined, password: node.password || undefined
            })
        };
    }
    if (node.type === 'http') {
        return {
            label: 'sing-box 出站 JSON',
            object: cleanObject({
                type: 'http', tag, ...dial, username: node.username || undefined,
                password: node.password || undefined, tls: node.tls ? tlsBlock(node) : undefined
            })
        };
    }
    if (node.type === 'ssh') {
        return {
            label: 'sing-box 出站 JSON',
            object: cleanObject({
                type: 'ssh', tag, ...dial, user: node.username, password: node.password || undefined,
                private_key: node.privateKey || undefined, host_key: node.hostKey ? [node.hostKey] : undefined
            })
        };
    }
    if (node.type === 'snell') {
        return {
            label: 'sing-box 出站 JSON',
            object: cleanObject({
                type: 'snell', tag, ...dial, version: Number(node.version || 4), psk: node.password,
                obfs_mode: node.obfs || undefined, obfs_host: node.obfsParam || undefined,
                mode: node.protocol || undefined
            })
        };
    }
    if (node.type === 'shadowtls') {
        return {
            label: 'sing-box 出站 JSON',
            object: cleanObject({
                type: 'shadowtls', tag, ...dial, version: Number(node.version || 3), password: node.password || undefined,
                tls: tlsBlock({ ...node, tls: true })
            })
        };
    }
    if (node.type === 'naive') {
        return {
            label: 'sing-box 出站 JSON',
            object: cleanObject({
                type: 'naive', tag, ...dial, username: node.username, password: node.password,
                quic: node.network === 'quic' || undefined,
                tls: tlsBlock({ ...node, tls: true })
            })
        };
    }
    if (node.type === 'ssr') {
        return {
            label: 'JSON（sing-box 和当前 Xray 都没有 SSR 出站）',
            object: cleanObject({
                type: 'shadowsocksr',
                tag,
                ...dial,
                method: node.cipher,
                password: node.password,
                protocol: node.protocol || undefined,
                protocol_param: node.protocolParam || undefined,
                obfs: node.obfs || undefined,
                obfs_param: node.obfsParam || undefined
            })
        };
    }
    return {
        label: 'JSON',
        object: cleanObject({ type: node.type, tag, ...dial })
    };
}

export function nodeViews(node) {
    let clash = null;
    let note = '';
    try {
        clash = nodeToClashProxy(node);
    } catch (error) {
        note = error.message || '';
    }
    const jsonDoc = useXray(node)
        ? { label: 'Xray 出站 JSON', object: xrayOutbound(node) }
        : singboxOutbound(node);
    const yamlObject = clash || jsonDoc.object;
    return {
        yaml: `${stringify(yamlObject).trimEnd()}\n`,
        yamlLabel: clash ? 'Clash Meta YAML' : 'YAML（Clash Meta 无法完整表达）',
        json: `${JSON.stringify(jsonDoc.object, null, 2)}\n`,
        jsonLabel: jsonDoc.label,
        note
    };
}
