// utils.js - Shared utility functions for Star Rewards

// HTML 转义函数，防止 XSS 攻击
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// 显示临时消息
function showTemporaryMessage(message, type) {
    const existing = document.querySelector('.temporary-message');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'temporary-message ' + (type || 'info');
    el.textContent = message;
    el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:15px 25px;border-radius:8px;color:white;font-weight:bold;z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    
    if (type === 'success') {
        el.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
    } else if (type === 'error') {
        el.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
    } else if (type === 'warning') {
        el.style.background = 'linear-gradient(135deg, #ff9800, #e65100)';
    } else {
        el.style.background = 'linear-gradient(135deg, #2196F3, #1565C0)';
    }

    document.body.appendChild(el);

    setTimeout(() => {
        el.style.transition = 'opacity 0.5s ease';
        el.style.opacity = '0';
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 500);
    }, 3000);
}
