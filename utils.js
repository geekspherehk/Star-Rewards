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

// Loading indicator - shows/hides a spinner overlay
function showLoading(message = 'Loading...') {
    hideLoading();
    const el = document.createElement('div');
    el.id = 'loading-overlay';
    el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;border:3px solid rgba(255,255,255,0.3);border-top:3px solid white;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
            <span style="color:white;font-size:0.9rem;">${escapeHtml(message)}</span>
        </div>
    `;
    el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:2000;';
    document.body.appendChild(el);

    // Inject keyframes once
    if (!document.getElementById('loading-keyframes')) {
        const style = document.createElement('style');
        style.id = 'loading-keyframes';
        style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    }
}

function hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.remove();
}

// Confirmation dialog
function showConfirm(message, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:3000;';

    const dialog = document.createElement('div');
    dialog.style.cssText = 'background:white;border-radius:12px;padding:24px 28px;max-width:380px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);text-align:center;';
    dialog.innerHTML = `
        <p style="font-size:1rem;color:#333;margin-bottom:20px;line-height:1.5;">${escapeHtml(message)}</p>
        <div style="display:flex;gap:10px;justify-content:center;">
            <button class="confirm-btn confirm-cancel" style="padding:10px 24px;border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;background:#e0e0e0;color:#333;">Cancel</button>
            <button class="confirm-btn confirm-ok" style="padding:10px 24px;border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;background:#f44336;color:white;font-weight:600;">Confirm</button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const cancelBtn = dialog.querySelector('.confirm-cancel');
    const okBtn = dialog.querySelector('.confirm-ok');

    function cleanup() {
        overlay.remove();
    }

    cancelBtn.onclick = () => { cleanup(); if (onCancel) onCancel(); };
    okBtn.onclick = () => { cleanup(); if (onConfirm) onConfirm(); };
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { cleanup(); if (onCancel) onCancel(); }
    });
}
