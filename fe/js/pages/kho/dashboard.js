/**
 * Nhân viên chức vụ Quản lý kho — tồn kho, nhập/xuất thuốc & vaccine, cảnh báo.
 */
const PageKhoDashboard = {
  _esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  },

  _list(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.results)) return data.results;
    return [];
  },

  /** Gom lỗi DRF (detail / field errors) thành một chuỗi hiển thị toast. */
  _formatLoiApi(data) {
    if (data == null) return 'Gửi phiếu thất bại';
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data)) {
      const t = data.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('; ');
      return t || 'Gửi phiếu thất bại';
    }
    if (typeof data === 'object') {
      const parts = [];
      for (const [k, v] of Object.entries(data)) {
        if (v == null) continue;
        if (typeof v === 'string') parts.push(`${k}: ${v}`);
        else if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`);
        else if (typeof v === 'object') parts.push(`${k}: ${JSON.stringify(v)}`);
        else parts.push(`${k}: ${String(v)}`);
      }
      if (parts.length) return parts.join('; ');
    }
    return 'Gửi phiếu thất bại';
  },

  _setNavActive(tab) {
    document.querySelectorAll('[data-kho-nav]').forEach((b) => {
      const on = b.getAttribute('data-kho-nav') === tab;
      b.classList.toggle('active', on);
    });
  },

  async render() {
    const { hoTen } = Auth.layThongTin();
    const navHtml = `
      <button type="button" class="nav-item" data-kho-nav="canh-bao" onclick="PageKhoDashboard.loadMain('canh-bao')"><i class="fas fa-exclamation-triangle"></i><span>Cảnh báo tồn</span></button>
      <button type="button" class="nav-item" data-kho-nav="thuoc" onclick="PageKhoDashboard.loadMain('thuoc')"><i class="fas fa-pills"></i><span>Kho thuốc</span></button>
      <button type="button" class="nav-item" data-kho-nav="vaccine" onclick="PageKhoDashboard.loadMain('vaccine')"><i class="fas fa-syringe"></i><span>Kho vaccine</span></button>
      <button type="button" class="nav-item" data-kho-nav="phieu-nhap" onclick="PageKhoDashboard.loadMain('phieu-nhap')"><i class="fas fa-file-import"></i><span>Tạo phiếu nhập kho</span></button>
      <button type="button" class="nav-item" data-kho-nav="lich-su-nhap" onclick="PageKhoDashboard.loadMain('lich-su-nhap')"><i class="fas fa-history"></i><span>Lịch sử nhập kho</span></button>`;
    window.RoleDashboardShell.mount('app-root', {
      brandTitle: 'PhòngKhám+',
      brandAccent: 'Kho',
      brandIcon: 'fa-warehouse',
      navHtml,
      mainHostId: 'kho-main',
      userName: hoTen || 'Nhân viên',
      userRoleLabel: 'Quản lý kho thuốc & vaccine',
      contentMaxWidth: '1180px',
    });
    await this.loadMain('canh-bao');
  },

  async loadMain(tab) {
    this._setNavActive(tab);
    const host = document.getElementById('kho-main');
    if (!host) return;
    host.innerHTML = '<p class="text-muted">Đang tải…</p>';
    if (tab === 'canh-bao') return this._canhBao(host);
    if (tab === 'thuoc') return this._bangKhoThuoc(host);
    if (tab === 'vaccine') return this._bangKhoVaccine(host);
    if (tab === 'phieu-nhap') return this._taoPhieuNhapKho(host);
    if (tab === 'lich-su-nhap') return this._lichSuNhapKho(host);
    return this._canhBao(host);
  },

  async _canhBao(host) {
    const res = await Http.layDanhSach('/thuoc/dashboard/canh_bao_ton_kho/');
    if (!res.ok || !res.data) {
      host.innerHTML = '<div class="card"><div class="card-body">Không tải được cảnh báo.</div></div>';
      return;
    }
    const d = res.data;
    const hangT = (d.thuoc_sap_het_hang || [])
      .map((x) => `<tr><td>${this._esc(x.thuoc)}</td><td>${x.ton_kho}</td></tr>`)
      .join('');
    const hangV = (d.vaccine_sap_het_hang || [])
      .map((x) => `<tr><td>${this._esc(x.vaccine)}</td><td>${x.ton_kho}</td></tr>`)
      .join('');
    const hetHanT = (d.thuoc_sap_het_han || [])
      .map(
        (r) =>
          `<tr><td>${this._esc(r.ten_thuoc)}</td><td>${this._esc(r.lo_sx || '')}</td><td>${r.so_luong}</td><td>${r.han_su_dung || ''}</td></tr>`
      )
      .join('');
    const hetHanV = (d.vaccine_sap_het_han || [])
      .map(
        (r) =>
          `<tr><td>${this._esc(r.ten_vaccine)}</td><td>${this._esc(r.lo_sx || '')}</td><td>${r.so_luong}</td><td>${r.han_su_dung || ''}</td></tr>`
      )
      .join('');
    host.innerHTML = `
      <div class="card mb-2"><div class="card-header"><strong>Cảnh báo sắp hết hàng (&lt; 10 đơn vị còn hạn)</strong></div>
        <div class="card-body">
          <p class="small text-muted">Thuốc</p>
          <table class="data-table" style="width:100%;font-size:13px"><thead><tr><th>Tên</th><th>Tồn</th></tr></thead><tbody>${hangT || '<tr><td colspan="2">Không có</td></tr>'}</tbody></table>
          <p class="small text-muted mt-3">Vaccine</p>
          <table class="data-table" style="width:100%;font-size:13px"><thead><tr><th>Tên</th><th>Tồn</th></tr></thead><tbody>${hangV || '<tr><td colspan="2">Không có</td></tr>'}</tbody></table>
        </div></div>
      <div class="card"><div class="card-header"><strong>Cảnh báo sắp hết hạn (90 ngày)</strong></div>
        <div class="card-body">
          <p class="small text-muted">Lô thuốc</p>
          <table class="data-table" style="width:100%;font-size:13px"><thead><tr><th>Thuốc</th><th>Lô</th><th>SL</th><th>Hạn</th></tr></thead><tbody>${hetHanT || '<tr><td colspan="4">Không có</td></tr>'}</tbody></table>
          <p class="small text-muted mt-3">Lô vaccine</p>
          <table class="data-table" style="width:100%;font-size:13px"><thead><tr><th>Vaccine</th><th>Lô</th><th>SL</th><th>Hạn</th></tr></thead><tbody>${hetHanV || '<tr><td colspan="4">Không có</td></tr>'}</tbody></table>
        </div></div>`;
  },

  async _bangKhoThuoc(host) {
    const res = await Http.layDanhSach('/thuoc/thuoc/?trang_thai=true&ordering=ma_thuoc&page_size=200');
    const rows = this._list(res.data);
    host.innerHTML = `
      <div class="card"><div class="card-header"><strong>Kho thuốc — theo danh mục</strong></div>
        <div class="card-body" style="overflow:auto">
          <table class="data-table" style="width:100%;font-size:13px">
            <thead><tr><th>Mã</th><th>Tên thuốc</th><th>Đơn vị</th><th>Tổng tồn</th><th>Hạn gần nhất</th><th></th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (r) => `
                <tr>
                  <td>${this._esc(r.ma_thuoc || '')}</td>
                  <td>${this._esc(r.ten_thuoc || '')}</td>
                  <td>${this._esc(r.don_vi_ten || '')}</td>
                  <td>${r.ton_kho != null ? r.ton_kho : '—'}</td>
                  <td>${r.han_sd_gan_nhat || '—'}</td>
                  <td><button type="button" class="btn btn-outline btn-sm" onclick="PageKhoDashboard._moXuatLoThuoc('${r.id}')">Lô &amp; xuất</button></td>
                </tr>`
                )
                .join('') || '<tr><td colspan="6" class="text-muted">Chưa có thuốc trong danh mục.</td></tr>'}
            </tbody>
          </table>
        </div></div>`;
  },

  async _bangKhoVaccine(host) {
    const res = await Http.layDanhSach('/thuoc/vaccine/?trang_thai=true&ordering=ma_vaccine&page_size=200');
    const rows = this._list(res.data);
    host.innerHTML = `
      <div class="card"><div class="card-header"><strong>Kho vaccine — theo danh mục</strong></div>
        <div class="card-body" style="overflow:auto">
          <table class="data-table" style="width:100%;font-size:13px">
            <thead><tr><th>Mã</th><th>Tên vaccine</th><th>Tổng tồn</th><th>Hạn gần nhất</th><th></th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (r) => `
                <tr>
                  <td>${this._esc(r.ma_vaccine || '')}</td>
                  <td>${this._esc(r.ten_vaccine || '')}</td>
                  <td>${r.ton_kho != null ? r.ton_kho : '—'}</td>
                  <td>${r.han_sd_gan_nhat || '—'}</td>
                  <td><button type="button" class="btn btn-outline btn-sm" onclick="PageKhoDashboard._moXuatLoVaccine('${r.id}')">Lô &amp; xuất</button></td>
                </tr>`
                )
                .join('') || '<tr><td colspan="5" class="text-muted">Chưa có vaccine trong danh mục.</td></tr>'}
            </tbody>
          </table>
        </div></div>`;
  },

  _dongOverlayXuatKho() {
    const el = document.getElementById('kho-overlay-xuat-lo');
    if (el) el.remove();
  },

  async _moXuatLoThuoc(thuocId) {
    const res = await Http.layDanhSach(
      `/thuoc/kho-thuoc/?thuoc=${encodeURIComponent(thuocId)}&ordering=han_su_dung&page_size=200`
    );
    const lots = this._list(res.data);
    const body =
      lots.length === 0
        ? '<p class="text-muted">Chưa có lô tồn cho thuốc này.</p>'
        : `<table class="data-table" style="width:100%;font-size:13px"><thead><tr><th>Lô</th><th>SL</th><th>Hạn</th><th></th></tr></thead><tbody>
            ${lots
              .map(
                (k) => `
              <tr>
                <td>${this._esc(k.lo_sx || '—')}</td>
                <td>${k.so_luong}</td>
                <td>${k.han_su_dung || ''}</td>
                <td><button type="button" class="btn btn-outline btn-sm" onclick="PageKhoDashboard._xuatThuocLo('${k.id}')">Xuất</button></td>
              </tr>`
              )
              .join('')}
          </tbody></table>`;
    this._dongOverlayXuatKho();
    const ov = document.createElement('div');
    ov.id = 'kho-overlay-xuat-lo';
    ov.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    ov.innerHTML = `
      <div class="card" style="max-width:560px;width:100%;max-height:90vh;overflow:auto">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <strong>Xuất theo lô — thuốc</strong>
          <button type="button" class="btn btn-outline btn-sm" onclick="PageKhoDashboard._dongOverlayXuatKho()">Đóng</button>
        </div>
        <div class="card-body">${body}</div>
      </div>`;
    ov.onclick = (e) => {
      if (e.target === ov) this._dongOverlayXuatKho();
    };
    document.body.appendChild(ov);
  },

  async _moXuatLoVaccine(vaccineId) {
    const res = await Http.layDanhSach(
      `/thuoc/kho-vaccine/?vaccine=${encodeURIComponent(vaccineId)}&ordering=han_su_dung&page_size=200`
    );
    const lots = this._list(res.data);
    const body =
      lots.length === 0
        ? '<p class="text-muted">Chưa có lô tồn cho vaccine này.</p>'
        : `<table class="data-table" style="width:100%;font-size:13px"><thead><tr><th>Lô</th><th>SL</th><th>Hạn</th><th></th></tr></thead><tbody>
            ${lots
              .map(
                (k) => `
              <tr>
                <td>${this._esc(k.lo_sx || '—')}</td>
                <td>${k.so_luong}</td>
                <td>${k.han_su_dung || ''}</td>
                <td><button type="button" class="btn btn-outline btn-sm" onclick="PageKhoDashboard._xuatVaccineLo('${k.id}')">Xuất</button></td>
              </tr>`
              )
              .join('')}
          </tbody></table>`;
    this._dongOverlayXuatKho();
    const ov = document.createElement('div');
    ov.id = 'kho-overlay-xuat-lo';
    ov.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    ov.innerHTML = `
      <div class="card" style="max-width:560px;width:100%;max-height:90vh;overflow:auto">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <strong>Xuất theo lô — vaccine</strong>
          <button type="button" class="btn btn-outline btn-sm" onclick="PageKhoDashboard._dongOverlayXuatKho()">Đóng</button>
        </div>
        <div class="card-body">${body}</div>
      </div>`;
    ov.onclick = (e) => {
      if (e.target === ov) this._dongOverlayXuatKho();
    };
    document.body.appendChild(ov);
  },

  async _xuatThuocLo(id) {
    const sl = window.prompt('Số lượng xuất khỏi lô này?', '1');
    if (sl == null) return;
    const n = parseInt(sl, 10);
    if (!n || n < 1) return Toast.hien('Lỗi', 'Số lượng không hợp lệ', 'error');
    const res = await Http.tao(`/thuoc/kho-thuoc/${id}/xuat-sl/`, { so_luong: n });
    if (res.ok) {
      Toast.hien('Đã xuất kho', '', 'success');
      this._dongOverlayXuatKho();
      const host = document.getElementById('kho-main');
      if (host) await this._bangKhoThuoc(host);
    } else Toast.hien('Lỗi', (res.data && res.data.error) || 'Xuất thất bại', 'error');
  },

  async _xuatVaccineLo(id) {
    const sl = window.prompt('Số lượng xuất khỏi lô này?', '1');
    if (sl == null) return;
    const n = parseInt(sl, 10);
    if (!n || n < 1) return Toast.hien('Lỗi', 'Số lượng không hợp lệ', 'error');
    const res = await Http.tao(`/thuoc/kho-vaccine/${id}/xuat-sl/`, { so_luong: n });
    if (res.ok) {
      Toast.hien('Đã xuất kho', '', 'success');
      this._dongOverlayXuatKho();
      const host = document.getElementById('kho-main');
      if (host) await this._bangKhoVaccine(host);
    } else Toast.hien('Lỗi', (res.data && res.data.error) || 'Xuất thất bại', 'error');
  },

  _maPhieuNhapMoi() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const r = String(Math.floor(1000 + Math.random() * 9000));
    return `PNK-${y}${m}${day}-${r}`;
  },

  async _taoPhieuNhapKho(host) {
    let thuoc = [];
    let vac = [];
    let ncc = [];
    try {
      const [rt, rv, rn] = await Promise.all([
        Http.layDanhSach('/thuoc/thuoc/?page_size=500'),
        Http.layDanhSach('/thuoc/vaccine/?page_size=500'),
        Http.layDanhSach('/thuoc/nha-cung-cap/?page_size=200'),
      ]);
      thuoc = this._list(rt.data);
      vac = this._list(rv.data);
      ncc = this._list(rn.data);
    } catch (e) {
      host.innerHTML = '<div class="card"><div class="card-body">Lỗi tải danh mục.</div></div>';
      return;
    }
    if (!ncc.length) {
      host.innerHTML =
        '<div class="card"><div class="card-body">Chưa có nhà cung cấp trong hệ thống. Vui lòng nhờ quản trị thêm NCC trước khi lập phiếu nhập.</div></div>';
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const nextY = new Date();
    nextY.setFullYear(nextY.getFullYear() + 1);
    const defHan = nextY.toISOString().slice(0, 10);
    this._phieuTam = [];
    this._phieuThuocList = thuoc;
    this._phieuVacList = vac;
    host.innerHTML = `
      <p class="text-muted small mb-2">Lập phiếu nhập kho — tồn kho chỉ tăng sau khi kế toán duyệt phiếu. Có thể in phiếu sau khi gửi thành công.</p>
      <div class="card mb-3"><div class="card-header"><strong>Thông tin phiếu</strong></div>
        <div class="card-body">
          <div class="form-row" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
            <div class="form-group"><label>Loại nhập</label>
              <select id="pk-loai" class="form-control" onchange="PageKhoDashboard._onDoiLoaiPhieu()">
                <option value="THUOC">Thuốc</option>
                <option value="VACCINE">Vaccine</option>
              </select>
            </div>
            <div class="form-group"><label>Nhà cung cấp</label>
              <select id="pk-ncc" class="form-control">${ncc.map((n) => `<option value="${n.id}">${this._esc(n.ten_ncc || n.ma_ncc)}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Ngày chứng từ</label><input type="date" id="pk-ngay-ct" class="form-control" value="${today}"/></div>
            <div class="form-group"><label>Số chứng từ</label><input type="text" id="pk-so-ct" class="form-control" placeholder="tùy chọn"/></div>
          </div>
          <div class="form-group"><label>Ghi chú</label><input type="text" id="pk-ghi-chu" class="form-control" placeholder="tùy chọn"/></div>
        </div></div>
      <div class="card mb-3"><div class="card-header"><strong>Thêm dòng hàng</strong></div>
        <div class="card-body">
          <div class="form-group" id="pk-wrap-sp"><label>Thuốc</label>
            <select id="pk-sp" class="form-control" onchange="PageKhoDashboard._pkGiaMacDinh()">
              ${thuoc.map((t) => `<option value="${t.id}" data-gia-nhap="${t.don_gia_nhap != null ? t.don_gia_nhap : ''}">${this._esc(t.ma_thuoc)} — ${this._esc(t.ten_thuoc)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row" style="display:flex;gap:12px;flex-wrap:wrap">
            <div class="form-group"><label>Số lượng</label><input type="number" id="pk-sl" class="form-control" min="1" value="1"/></div>
            <div class="form-group"><label>Đơn giá nhập</label><input type="number" id="pk-dg" class="form-control" min="0" step="1"/></div>
            <div class="form-group"><label>Hạn SD</label><input type="date" id="pk-han" class="form-control" value="${defHan}"/></div>
            <div class="form-group"><label>Lô SX</label><input type="text" id="pk-lo" class="form-control" placeholder="tùy chọn"/></div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="PageKhoDashboard._pkThemDong()">Thêm vào phiếu</button>
        </div></div>
      <div class="card mb-3"><div class="card-header"><strong>Chi tiết phiếu</strong></div>
        <div class="card-body" style="overflow:auto">
          <table class="data-table" style="width:100%;font-size:13px"><thead><tr><th>Mặt hàng</th><th>SL</th><th>Đơn giá</th><th>Hạn</th><th>Lô</th><th></th></tr></thead>
          <tbody id="pk-tbody"><tr><td colspan="6" class="text-muted">Chưa có dòng.</td></tr></tbody></table>
          <button type="button" class="btn btn-primary btn-sm mt-2" onclick="PageKhoDashboard._pkGuiPhieu()">Gửi phiếu nhập kho</button>
        </div></div>
      <div id="pk-print-host" style="display:none"></div>`;
    this._pkGiaMacDinh();
  },

  _onDoiLoaiPhieu() {
    this._phieuTam = [];
    const tb = document.getElementById('pk-tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="6" class="text-muted">Chưa có dòng.</td></tr>';
    const loai = document.getElementById('pk-loai')?.value;
    const wrap = document.getElementById('pk-wrap-sp');
    const sel = document.getElementById('pk-sp');
    if (!wrap || !sel) return;
    if (loai === 'THUOC') {
      wrap.innerHTML = `<label>Thuốc</label><select id="pk-sp" class="form-control" onchange="PageKhoDashboard._pkGiaMacDinh()">
        ${(this._phieuThuocList || []).map((t) => `<option value="${t.id}" data-gia-nhap="${t.don_gia_nhap != null ? t.don_gia_nhap : ''}">${this._esc(t.ma_thuoc)} — ${this._esc(t.ten_thuoc)}</option>`).join('')}
      </select>`;
    } else {
      wrap.innerHTML = `<label>Vaccine</label><select id="pk-sp" class="form-control" onchange="PageKhoDashboard._pkGiaMacDinh()">
        ${(this._phieuVacList || []).map((t) => `<option value="${t.id}" data-gia-nhap="${t.gia_nhap != null ? t.gia_nhap : ''}">${this._esc(t.ma_vaccine)} — ${this._esc(t.ten_vaccine)}</option>`).join('')}
      </select>`;
    }
    this._pkGiaMacDinh();
  },

  _pkGiaMacDinh() {
    const sel = document.getElementById('pk-sp');
    const dg = document.getElementById('pk-dg');
    if (!sel || !dg || !sel.selectedOptions[0]) return;
    const g = sel.selectedOptions[0].getAttribute('data-gia-nhap');
    if (g !== null && g !== '') dg.value = g;
  },

  _pkThemDong() {
    const loai = document.getElementById('pk-loai')?.value;
    const sel = document.getElementById('pk-sp');
    const sl = parseInt(document.getElementById('pk-sl')?.value || '0', 10);
    const donGia = parseFloat(document.getElementById('pk-dg')?.value || '0') || 0;
    const han = document.getElementById('pk-han')?.value;
    const lo = (document.getElementById('pk-lo')?.value || '').trim();
    if (!sel?.value || !sl || sl < 1 || !han) {
      return Toast.hien('Lỗi', 'Kiểm tra số lượng và hạn sử dụng', 'error');
    }
    const ngayCt = document.getElementById('pk-ngay-ct')?.value;
    if (han <= ngayCt) return Toast.hien('Lỗi', 'Hạn SD phải sau ngày chứng từ', 'error');
    const ten = sel.selectedOptions[0].textContent || '';
    const line = {
      loai,
      id: sel.value,
      ten,
      so_luong: sl,
      don_gia: donGia,
      han_su_dung: han,
      lo_sx: lo,
    };
    this._phieuTam = this._phieuTam || [];
    this._phieuTam.push(line);
    const tb = document.getElementById('pk-tbody');
    if (tb) {
      tb.innerHTML = this._phieuTam
        .map(
          (r, i) => `
        <tr>
          <td>${this._esc(r.ten)}</td>
          <td>${r.so_luong}</td>
          <td>${Number(r.don_gia || 0).toLocaleString('vi-VN')}</td>
          <td>${r.han_su_dung}</td>
          <td>${this._esc(r.lo_sx || '')}</td>
          <td><button type="button" class="btn btn-outline btn-sm" onclick="PageKhoDashboard._pkXoaDong(${i})">Xóa</button></td>
        </tr>`
        )
        .join('');
    }
  },

  _pkXoaDong(idx) {
    if (!this._phieuTam || idx < 0) return;
    this._phieuTam.splice(idx, 1);
    const tb = document.getElementById('pk-tbody');
    if (tb) {
      if (!this._phieuTam.length) tb.innerHTML = '<tr><td colspan="6" class="text-muted">Chưa có dòng.</td></tr>';
      else
        tb.innerHTML = this._phieuTam
          .map(
            (r, i) => `
        <tr>
          <td>${this._esc(r.ten)}</td>
          <td>${r.so_luong}</td>
          <td>${Number(r.don_gia || 0).toLocaleString('vi-VN')}</td>
          <td>${r.han_su_dung}</td>
          <td>${this._esc(r.lo_sx || '')}</td>
          <td><button type="button" class="btn btn-outline btn-sm" onclick="PageKhoDashboard._pkXoaDong(${i})">Xóa</button></td>
        </tr>`
          )
          .join('');
    }
  },

  async _pkGuiPhieu() {
    const loai = document.getElementById('pk-loai')?.value;
    const ncc = document.getElementById('pk-ncc')?.value;
    const ngayCt = document.getElementById('pk-ngay-ct')?.value;
    const soCt = (document.getElementById('pk-so-ct')?.value || '').trim();
    const ghiChu = (document.getElementById('pk-ghi-chu')?.value || '').trim();
    const rowsAll = this._phieuTam || [];
    const rows = rowsAll.filter((r) => r.loai === loai);
    if (!ncc || !ngayCt) return Toast.hien('Lỗi', 'Chọn NCC và ngày chứng từ', 'error');
    if (!rowsAll.length) return Toast.hien('Lỗi', 'Thêm ít nhất một dòng hàng', 'error');
    if (!rows.length) {
      return Toast.hien(
        'Lỗi',
        'Dòng hàng không khớp loại nhập (ví dụ đổi Thuốc ↔ Vaccine sau khi đã thêm dòng). Hãy thêm lại dòng cho đúng loại.',
        'error'
      );
    }
    const maPhieu = this._maPhieuNhapMoi();
    const payload = {
      ma_phieu: maPhieu,
      loai_nhap: loai,
      nha_cung_cap: ncc,
      ngay_chung_tu: ngayCt,
      so_chung_tu: soCt,
      ghi_chu: ghiChu,
      chi_tiet_thuoc: [],
      chi_tiet_vaccine: [],
    };
    if (loai === 'THUOC') {
      payload.chi_tiet_thuoc = rows.map((r) => ({
        thuoc: r.id,
        so_luong: r.so_luong,
        don_gia: String(r.don_gia ?? 0),
        han_su_dung: r.han_su_dung,
        lo_sx: r.lo_sx || '',
      }));
    } else {
      payload.chi_tiet_vaccine = rows.map((r) => ({
        vaccine: r.id,
        so_luong: r.so_luong,
        don_gia: String(r.don_gia ?? 0),
        han_su_dung: r.han_su_dung,
        lo_sx: r.lo_sx || '',
      }));
    }
    const res = await Http.tao('/thuoc/phieu-nhap/', payload);
    if (res.ok && res.data) {
      Toast.hien('Đã tạo phiếu', 'Chờ kế toán duyệt để cập nhật tồn kho.', 'success');
      this._phieuInNhap(res.data);
    } else {
      Toast.hien('Lỗi', this._formatLoiApi(res.data), 'error');
    }
  },

  _phieuInNhap(phieu) {
    const w = window.open('', '_blank');
    if (!w) return;
    const loai = phieu.loai_nhap === 'VACCINE' ? 'Vaccine' : 'Thuốc';
    const ct =
      phieu.loai_nhap === 'VACCINE'
        ? (phieu.chi_tiet_vaccine || [])
        : (phieu.chi_tiet_thuoc || []);
    const rows = ct
      .map(
        (c) =>
          `<tr><td>${this._esc(c.ten_vaccine || c.ten_thuoc || '')}</td><td>${c.so_luong}</td><td>${Number(c.don_gia || 0).toLocaleString('vi-VN')}</td><td>${c.han_su_dung || ''}</td><td>${this._esc(c.lo_sx || '')}</td></tr>`
      )
      .join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Phiếu nhập ${this._esc(phieu.ma_phieu || '')}</title>
      <style>body{font-family:Segoe UI,sans-serif;padding:24px} h1{font-size:18px} table{border-collapse:collapse;width:100%;font-size:13px} th,td{border:1px solid #ccc;padding:6px;text-align:left}</style></head><body>
      <h1>PHIẾU NHẬP KHO</h1>
      <p><strong>Mã phiếu:</strong> ${this._esc(phieu.ma_phieu || '')} &nbsp; <strong>Loại:</strong> ${loai}</p>
      <p><strong>NCC:</strong> ${this._esc(phieu.ten_nha_cung_cap || '')}</p>
      <p><strong>Ngày chứng từ:</strong> ${phieu.ngay_chung_tu || ''} &nbsp; <strong>Người lập:</strong> ${this._esc(phieu.nguoi_nhap || '')}</p>
      <p class="small text-muted">Phiếu có hiệu lực nghiệp vụ sau khi kế toán duyệt — tồn kho cập nhật theo bước duyệt.</p>
      <table><thead><tr><th>Mặt hàng</th><th>SL</th><th>Đơn giá</th><th>Hạn SD</th><th>Lô</th></tr></thead><tbody>${rows}</tbody></table>
      <p><strong>Tổng tiền:</strong> ${Number(phieu.tong_tien || 0).toLocaleString('vi-VN')} đ</p>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
  },

  async _lichSuNhapKho(host) {
    const res = await Http.layDanhSach('/thuoc/phieu-nhap/?ordering=-ngay_nhap&page_size=100');
    const rows = this._list(res.data);
    host.innerHTML = `
      <div class="card"><div class="card-header"><strong>Lịch sử phiếu nhập kho</strong></div>
        <div class="card-body" style="overflow:auto">
          <table class="data-table" style="width:100%;font-size:13px">
            <thead><tr><th>Mã phiếu</th><th>Loại</th><th>NCC</th><th>Ngày lập</th><th>Tổng tiền</th><th>Đã duyệt</th><th>Đã cập nhật kho</th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (p) => `
                <tr>
                  <td>${this._esc(p.ma_phieu || '')}</td>
                  <td>${this._esc(p.loai_nhap || '')}</td>
                  <td>${this._esc(p.ten_nha_cung_cap || '')}</td>
                  <td>${p.ngay_nhap ? String(p.ngay_nhap).slice(0, 16).replace('T', ' ') : ''}</td>
                  <td>${Number(p.tong_tien || 0).toLocaleString('vi-VN')}</td>
                  <td>${p.da_duyet_chi ? 'Có' : 'Chờ'}</td>
                  <td>${p.da_cap_nhat_kho ? 'Có' : 'Chưa'}</td>
                </tr>`
                )
                .join('') || '<tr><td colspan="7">Chưa có phiếu.</td></tr>'}
            </tbody>
          </table>
        </div></div>`;
  },
};

window.PageKhoDashboard = PageKhoDashboard;
