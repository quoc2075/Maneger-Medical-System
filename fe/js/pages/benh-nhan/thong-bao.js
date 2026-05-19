const PageThongBaoBenhNhan = {
  _poll: null,
  _open: false,
  _items: [],

  init() {
    this.taiThongBao();
    if (this._poll) clearInterval(this._poll);
    this._poll = setInterval(() => this.taiThongBao(false), 20000);
  },

  async taiThongBao(showToast = false) {
    const res = await Http.layDanhSach('/thong-bao/?page=1&page_size=15');
    const list = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
    const oldUnread = this._items.filter(i => !i.da_xem).length;
    this._items = list;
    const unread = list.filter(i => !i.da_xem).length;
    const badge = document.getElementById('bn-noti-badge');
    if (badge) {
      badge.textContent = unread;
      badge.style.display = unread > 0 ? 'inline-block' : 'none';
    }
    if (showToast && unread > oldUnread) {
      Toast.ok('Thông báo mới', 'Bạn có thông báo mới từ hệ thống');
    }
    if (this._open) this.renderPopup();
  },

  togglePopup(event) {
    if (event) event.stopPropagation();
    this._open = !this._open;
    this.renderPopup();
  },

  renderPopup() {
    let panel = document.getElementById('bn-noti-popup');
    if (!this._open) {
      if (panel) panel.remove();
      return;
    }
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'bn-noti-popup';
      panel.style.cssText = 'position:fixed;top:66px;right:16px;width:360px;max-height:420px;overflow:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 12px 30px rgba(15,23,42,.16);z-index:2000;padding:10px';
      document.body.appendChild(panel);
      setTimeout(() => {
        document.addEventListener('click', (e) => {
          if (!document.getElementById('bn-noti-popup')) return;
          if (!e.target.closest('#bn-noti-popup') && !e.target.closest('#bn-noti-badge') && !e.target.closest('.notification-bell')) {
            this._open = false;
            this.renderPopup();
          }
        }, { once: true });
      }, 0);
    }
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 4px 8px">
        <b>Thông báo</b>
        <button class="btn btn-outline btn-sm" onclick="PageThongBaoBenhNhan.danhDauTatCa()">Đánh dấu đã đọc</button>
      </div>
      ${this._items.length ? this._items.map(i => `
        <div onclick="PageThongBaoBenhNhan.danhDau('${i.id}')" style="padding:8px;border-radius:8px;margin-bottom:6px;background:${i.da_xem ? '#fff' : '#eff6ff'};cursor:pointer">
          <div style="font-weight:700">${this._esc(i.tieu_de || 'Thông báo')}</div>
          <div style="font-size:13px;color:#64748b">${this._esc(i.noi_dung || '')}</div>
        </div>
      `).join('') : '<p class="text-muted">Không có thông báo</p>'}
    `;
  },

  async danhDau(id) {
    await Http.tao(`/thong-bao/${id}/mark_as_read/`, {});
    await this.taiThongBao();
  },

  async danhDauTatCa() {
    await Http.tao('/thong-bao/mark_all_as_read/', {});
    await this.taiThongBao();
  },

  _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
};

window.PageThongBaoBenhNhan = PageThongBaoBenhNhan;
