// Chrome DevTools Protocol Client for Antigravity
export function pageTarget(target) {
  try {
    if (target.type !== 'page') return false;
    if (!target.url || typeof target.url !== 'string') return false;
    // Splash screen in Antigravity is a data: URL - ignore it completely!
    if (target.url.startsWith('data:')) return false;
    const url = new URL(target.url);
    // Ignore devtools internal pages
    if (url.protocol === 'devtools:' || url.protocol === 'chrome-extension:' || url.protocol === 'blob:') return false;
    // Antigravity window loads https://127.0.0.1:<port>/ or http://localhost/
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || target.title?.includes('Antigravity')) {
        return !/notification|mini|popover|quick.chat/i.test(target.url);
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function localSocket(value, port) {
  const url = new URL(value);
  if (url.protocol !== 'ws:' || (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost')) {
    throw new Error('Từ chối kết nối địa chỉ gỡ lỗi không thuộc máy cục bộ');
  }
  return url.href;
}

export async function connect(url, Socket = WebSocket) {
  const socket = new Socket(url);
  const pending = new Map();
  let serial = 0;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Kết nối gỡ lỗi CDP vượt quá thời gian (timeout)'));
    }, 8000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener('error', err => {
      clearTimeout(timer);
      reject(new Error('Không thể kết nối đến cổng CDP'));
    }, { once: true });
  });

  const listeners = new Map();

  socket.addEventListener('message', event => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    if (data.method) {
      const list = listeners.get(data.method);
      if (list) {
        for (const fn of list) {
          try { fn(data.params); } catch (e) { console.error(e); }
        }
      }
      return;
    }

    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    clearTimeout(request.timer);
    if (data.error) {
      request.reject(new Error(data.error.message));
    } else {
      request.resolve(data.result);
    }
  });

  let closed = false;
  socket.addEventListener('close', () => {
    closed = true;
    for (const req of pending.values()) {
      clearTimeout(req.timer);
      req.reject(new Error('Kết nối gỡ lỗi đã đóng'));
    }
    pending.clear();
    listeners.clear();
  });

  return {
    get closed() {
      return closed;
    },
    call(method, params = {}, timeout = 12000) {
      return new Promise((resolve, reject) => {
        const id = ++serial;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`${method} timed out`));
        }, timeout);
        pending.set(id, { resolve, reject, timer });
        try {
          socket.send(JSON.stringify({ id, method, params }));
        } catch (err) {
          clearTimeout(timer);
          pending.delete(id);
          reject(err);
        }
      });
    },
    on(method, callback) {
      if (!listeners.has(method)) listeners.set(method, new Set());
      listeners.get(method).add(callback);
      return () => listeners.get(method)?.delete(callback);
    },
    off(method, callback) {
      listeners.get(method)?.delete(callback);
    },
    close() {
      socket.close();
    }
  };
}
