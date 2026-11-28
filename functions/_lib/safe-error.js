import { UNSUPPORTED_SUBSCRIPTION_URL } from './url-guard.js';

export const GENERIC_SERVER_ERROR = '服务器内部错误';
export const GENERIC_REMOTE_ERROR = '无法获取远程订阅';
export const GENERIC_SUBSCRIBE_ERROR = '订阅生成失败';
export const REMOTE_TIMEOUT_ERROR = '请求超时（15秒）';
export const REMOTE_DENIED_ERROR = '远程服务器拒绝访问。请检查订阅链接，或在系统设置里启用 SOCKS5 代理后重试。';
export const REMOTE_REDIRECT_LIMIT_ERROR = '远程订阅重定向次数过多';

const ALLOWED = new Set([
    UNSUPPORTED_SUBSCRIPTION_URL,
    REMOTE_TIMEOUT_ERROR,
    REMOTE_DENIED_ERROR,
    REMOTE_REDIRECT_LIMIT_ERROR,
    '请输入订阅链接',
    '这条远程订阅没有来源地址',
    '资源不存在或不是远程订阅',
    '只支持通过代理获取 http 或 https 订阅',
    '订阅链接格式不正确',
    '通过代理获取订阅失败：重定向没有 Location',
    '通过代理获取订阅失败：重定向协议不受支持',
    '通过代理获取订阅失败：重定向次数过多',
    '没有填写 SOCKS5 主机',
    'SOCKS5 端口必须是 1 到 65535',
    '启用 SOCKS5 密码时必须填写用户名'
]);

export function safeErrorMessage(error, fallback = GENERIC_SERVER_ERROR) {
    const text = String(error?.message || error || '').trim();
    if (ALLOWED.has(text)) return text;
    if (text === '请求超时（15秒）') return REMOTE_TIMEOUT_ERROR;
    return fallback;
}

export function safeRemoteError(error) {
    const text = String(error?.message || error || '').trim();
    if (text.includes('超时')) return REMOTE_TIMEOUT_ERROR;
    if (text === UNSUPPORTED_SUBSCRIPTION_URL || error?.name === 'UnsafeSubscriptionUrlError') {
        return UNSUPPORTED_SUBSCRIPTION_URL;
    }
    if (ALLOWED.has(text)) return text;
    // 已知的用户可读校验文案（代理配置等），不含链接或异常堆栈
    if (/没有填写 SOCKS5|端口必须是|必须填写用户名|当前环境不支持出站 TCP/.test(text)) return text;
    return GENERIC_REMOTE_ERROR;
}
