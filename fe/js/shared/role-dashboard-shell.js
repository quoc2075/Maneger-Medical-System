/**
 * Layout dashboard vai trò — cùng phong cách với admin (sidebar + header cố định).
 * Dùng cho bệnh nhân, bác sĩ, lễ tân, bán thuốc, kho, kế toán (không thay thế trang /admin-dashboard).
 */
(function (global) {
  const STYLE_ID = 'role-dashboard-shell-styles';

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .admin-dashboard.role-shell-root {
        display: flex;
        min-height: 100vh;
        background: #f5f7fa;
      }
      .admin-sidebar.role-sidebar-shell {
        display: flex;
        flex-direction: column;
        width: 280px;
        background: linear-gradient(180deg, #0A2342 0%, #0F2D4F 100%);
        color: white;
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        overflow: hidden;
        transition: transform 0.3s ease;
        z-index: 1000;
      }
      .role-sidebar-shell .sidebar-header {
        padding: 24px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        flex-shrink: 0;
      }
      .role-sidebar-shell .sidebar-header .logo {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 20px;
        font-weight: 700;
      }
      .role-sidebar-shell .sidebar-header .logo i {
        font-size: 28px;
        color: #00C9A7;
      }
      .role-sidebar-shell .sidebar-header .logo span span {
        color: #00C9A7;
      }
      .role-sidebar-shell .sidebar-nav {
        padding: 20px 0;
        flex: 1;
        overflow-y: auto;
        padding-bottom: 24px;
      }
      .role-sidebar-shell .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
        color: rgba(255,255,255,0.7);
        text-decoration: none;
        transition: all 0.2s;
        border-left: 3px solid transparent;
        box-sizing: border-box;
      }
      .role-sidebar-shell button.nav-item {
        width: 100%;
        background: none;
        border: none;
        font: inherit;
        cursor: pointer;
        text-align: left;
      }
      .role-sidebar-shell .nav-item:hover {
        background: rgba(255,255,255,0.05);
        color: white;
      }
      .role-sidebar-shell .nav-item.active {
        background: rgba(0,201,167,0.1);
        color: #00C9A7;
        border-left-color: #00C9A7;
      }
      .role-sidebar-shell .nav-item i {
        width: 20px;
        font-size: 16px;
        text-align: center;
      }
      .role-sidebar-shell .sidebar-footer {
        padding: 20px;
        border-top: 1px solid rgba(255,255,255,0.1);
        flex-shrink: 0;
        margin-top: auto;
      }
      .role-sidebar-shell .btn-logout {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 10px;
        background: rgba(239,68,68,0.1);
        border: none;
        border-radius: 8px;
        color: #f87171;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 14px;
        font-weight: 600;
      }
      .role-sidebar-shell .btn-logout:hover {
        background: rgba(239,68,68,0.2);
        color: #ef4444;
      }
      .role-shell-root .admin-main {
        flex: 1;
        margin-left: 280px;
        min-height: 100vh;
      }
      .role-shell-root .admin-header {
        background: white;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        gap: 16px;
        justify-content: space-between;
        border-bottom: 1px solid #e2e8f0;
        position: sticky;
        top: 0;
        z-index: 100;
      }
      .role-shell-root .menu-toggle {
        display: none;
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #4a5568;
        flex-shrink: 0;
      }
      .role-shell-root .header-search-spacer {
        flex: 1;
        max-width: 480px;
        min-width: 0;
      }
      .role-shell-root .header-actions {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-shrink: 0;
      }
      .role-shell-root .notification-bell {
        position: relative;
        cursor: pointer;
        font-size: 20px;
        color: #4a5568;
        background: none;
        border: none;
        padding: 4px 8px;
        border-radius: 8px;
      }
      .role-shell-root .notification-bell:hover {
        background: #f7fafc;
      }
      .role-shell-root .notification-bell .badge {
        position: absolute;
        top: -4px;
        right: -6px;
        background: #ef4444;
        color: white;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 18px;
        text-align: center;
      }
      .role-shell-root .user-menu {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 5px 10px;
        border-radius: 8px;
      }
      .role-shell-root .user-avatar {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #00C9A7, #1B6CA8);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 13px;
        color: white;
        flex-shrink: 0;
      }
      .role-shell-root .user-info {
        line-height: 1.3;
        min-width: 0;
      }
      .role-shell-root .user-name {
        font-weight: 600;
        font-size: 14px;
        color: #1e293b;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .role-shell-root .user-role {
        font-size: 11px;
        color: #64748b;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .role-shell-root .admin-content {
        padding: 24px;
      }
      .role-shell-inner {
        max-width: 1280px;
        margin: 0 auto;
      }
      @media (max-width: 768px) {
        .admin-sidebar.role-sidebar-shell {
          transform: translateX(-100%);
        }
        .admin-sidebar.role-sidebar-shell.open {
          transform: translateX(0);
        }
        .role-shell-root .admin-main {
          margin-left: 0;
        }
        .role-shell-root .menu-toggle {
          display: block;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function avatarText(name, explicit) {
    if (explicit) return esc(String(explicit).slice(0, 3).toUpperCase());
    if (global.UI && typeof global.UI.kyTuDau === 'function') return esc(global.UI.kyTuDau(name));
    const t = (name || '').trim().split(/\s+/).filter(Boolean);
    if (t.length >= 2) return esc((t[0][0] + t[t.length - 1][0]).toUpperCase());
    if (t.length === 1 && t[0].length) return esc(t[0].slice(0, 2).toUpperCase());
    return esc('?');
  }

  /**
   * @param {object} o
   * @param {string} o.brandTitle - dòng logo (HTML escaped)
   * @param {string} [o.brandAccent] - phần màu mint trong logo
   * @param {string} [o.brandIcon] - class FontAwesome
   * @param {string} o.navHtml - nút sidebar (nav-item + data-*-nav)
   * @param {string} o.mainHostId - id vùng nội dung chính
   * @param {string} [o.userName]
   * @param {string} [o.userRoleLabel] - hiển thị dưới tên
   * @param {string} [o.avatarText]
   * @param {string} [o.headerActionsExtra] - HTML trước khối user (vd nút chuông BN)
   * @param {string} [o.aboveMainContent] - HTML phía trên #mainHostId (vd strip bác sĩ)
   * @param {string} [o.contentMaxWidth] - default 1280px
   */
  function layoutHtml(o) {
    const brandAccent = o.brandAccent != null ? o.brandAccent : '';
    const icon = o.brandIcon || 'fa-hospital-user';
    const innerW = o.contentMaxWidth || '1280px';
    const extra = o.headerActionsExtra || '';
    const above = o.aboveMainContent || '';
    const av = avatarText(o.userName, o.avatarText);

    return `
      <div class="admin-dashboard role-shell-root">
        <aside class="admin-sidebar role-sidebar-shell" id="role-shell-sidebar">
          <div class="sidebar-header">
            <div class="logo">
              <i class="fas ${esc(icon)}"></i>
              <span>${esc(o.brandTitle || 'PhòngKhám+')}<span>${esc(brandAccent)}</span></span>
            </div>
          </div>
          <nav class="sidebar-nav">${o.navHtml}</nav>
          <div class="sidebar-footer">
            <button type="button" class="btn-logout" onclick="App.logout()">
              <i class="fas fa-sign-out-alt"></i>
              <span>Đăng xuất</span>
            </button>
          </div>
        </aside>
        <main class="admin-main">
          <header class="admin-header">
            <button type="button" class="menu-toggle" id="role-shell-menu-toggle" aria-label="Mở menu">
              <i class="fas fa-bars"></i>
            </button>
            <div class="header-search-spacer" aria-hidden="true"></div>
            <div class="header-actions">
              ${extra}
              <div class="user-menu">
                <div class="user-avatar" id="role-shell-user-avatar">${av}</div>
                <div class="user-info">
                  <div class="user-name" id="role-shell-user-name">${esc(o.userName || '')}</div>
                  <div class="user-role" id="role-shell-user-role">${esc(o.userRoleLabel || '')}</div>
                </div>
                <i class="fas fa-chevron-down" style="font-size:12px;color:#94a3b8"></i>
              </div>
            </div>
          </header>
          <div class="admin-content">
            <div class="role-shell-inner" style="max-width:${esc(innerW)}">
              ${above}
              <div id="${esc(o.mainHostId)}"></div>
            </div>
          </div>
        </main>
      </div>`;
  }

  function bindShellControls() {
    const btn = document.getElementById('role-shell-menu-toggle');
    const side = document.getElementById('role-shell-sidebar');
    if (btn && side) {
      btn.addEventListener('click', () => side.classList.toggle('open'));
    }
  }

  function mount(rootId, options) {
    injectStyles();
    const root = document.getElementById(rootId);
    if (!root) return;
    root.innerHTML = layoutHtml(options);
    bindShellControls();
  }

  global.RoleDashboardShell = {
    esc,
    injectStyles,
    layoutHtml,
    bindShellControls,
    mount,
  };
})(window);
