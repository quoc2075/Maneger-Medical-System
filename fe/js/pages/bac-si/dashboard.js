/**
 * Dashboard bác sĩ — hồ sơ BN (tab), chẩn đoán theo lần khám, đơn thuốc, chỉ định, tái khám.
 */
const PageBacSiDashboard = {
  _hoSoId: null,
  _benhNhanId: null,
  _benhNhanNguoiDungId: null,
  _lichHenId: null,
  _chanDoanDaLuu: false,
  /** Giữ thông tin BN đang khám khi chuyển tab (API không lồng nguoi_dung đầy đủ — dùng ho_ten từ serializer) */
  _patientSnapshot: null,
  /** true = xem hồ sơ từ Tìm kiếm (chỉ đọc CD + toa), không bật strip Đang khám */
  _hoSoXemChiTietTraCuu: false,

  _esc(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  /** API đôi khi trả benh_nhan là object — query cần UUID string */
  _idStr(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v !== null && v.id != null) return String(v.id);
    return '';
  },

  /** Chuỗi lỗi đọc được khi API trả non-JSON hoặc { detail } thay vì { error } */
  _msgApiLoi(res) {
    const d = res && res.data;
    if (d == null) {
      const st = res && res.status;
      if (st === 401) return 'Phiên đăng nhập hết hạn — vui lòng đăng nhập lại.';
      if (st === 403) return 'Không có quyền thực hiện (HTTP 403).';
      if (st === 404) return 'Không tìm thấy lịch — có thể lịch đã kết thúc hoặc không thuộc tài khoản bác sĩ.';
      if (st === 400 || st === 405) return 'Yêu cầu không hợp lệ — thử làm mới trang hoặc mở lại hồ sơ từ lịch hẹn.';
      if (st === 0) return 'Không kết nối được máy chủ.';
      return st ? `Lỗi HTTP ${st} (máy chủ không trả JSON chi tiết).` : 'Không có phản hồi từ máy chủ.';
    }
    if (typeof d === 'object' && d !== null) {
      if (d.error != null) return typeof d.error === 'string' ? d.error : JSON.stringify(d.error);
      if (d.detail != null) return typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail);
      const keys = Object.keys(d);
      if (keys.length) return JSON.stringify(d);
    }
    return String(d);
  },

  _bacSiId() {
    const u = Auth.layThongTin() || {};
    return u.bac_si_id || (u.role_data && u.role_data.id) || null;
  },

  _formatDateYMD(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  _defaultTaiKhamDatetimeLocal() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  _localDatetimeToNgayHenApi(v) {
    const s = (v || '').trim();
    if (!s) return '';
    return s.length === 16 ? `${s}:00` : s;
  },

  _dongModalHenTaiKham() {
    const el = document.getElementById('bs-hen-tk-overlay');
    if (el) el.remove();
  },

  _trangThaiTaiKham(tt) {
    const m = {
      CHUA_KHAM: 'Chưa khám',
      DA_KHAM: 'Đã khám',
      QUA_HAN: 'Quá hạn',
      HUY: 'Đã hủy',
    };
    return m[tt] || tt || '—';
  },

  /** Cập nhật snapshot từ object hồ sơ (retrieve hoặc mo-ho-so) */
  _setPatientSnapshotFromHoSo(h, lichHenId) {
    if (!h || !h.id) return;
    const bn = h.benh_nhan && typeof h.benh_nhan === 'object' ? h.benh_nhan : null;
    const ten =
      (bn && (bn.ho_ten || bn.nguoi_dung?.ho_ten)) || h.ten_benh_nhan || '';
    const maBn = (bn && bn.ma_benh_nhan) || h.ma_benh_nhan || '';
    const sdt = (bn && (bn.so_dien_thoai || bn.nguoi_dung?.so_dien_thoai)) || '';
    this._patientSnapshot = {
      maHs: h.ma_hs || '',
      tenBn: ten,
      maBn,
      sdt,
      hoSoId: h.id,
      lichHenId: lichHenId != null ? lichHenId : this._lichHenId,
    };
  },

  _refreshPatientStrip() {
    const el = document.getElementById('bs-patient-strip');
    if (!el) return;
    if (this._hoSoXemChiTietTraCuu) {
      el.innerHTML = '';
      el.style.display = 'none';
      return;
    }
    const s = this._patientSnapshot;
    const has = !!(this._hoSoId && s && s.hoSoId);
    if (!has) {
      el.innerHTML = '';
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    const lich = s.lichHenId ? ` • Lịch: ${this._esc(String(s.lichHenId).slice(0, 8))}…` : '';
    el.innerHTML = `
      <div class="card-body py-2 px-3" style="background:linear-gradient(90deg,#e8f4fc 0%,#fff 100%);border-left:4px solid var(--c-navy,#0a2342)">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div class="small">
            <strong>Đang khám:</strong>
            <span class="text-dark">${this._esc(s.tenBn || '—')}</span>
            <span class="text-muted"> — Mã BN ${this._esc(s.maBn || '—')}</span>
            ${s.sdt ? `<span class="text-muted"> — ${this._esc(s.sdt)}</span>` : ''}
            <span class="text-muted"> — Hồ sơ <code>${this._esc(s.maHs || '')}</code>${lich}</span>
          </div>
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-outline-primary" onclick="PageBacSiDashboard._moVeHoSoChiTiet()">Mở / làm mới hồ sơ</button>
            <button type="button" class="btn btn-success" onclick="PageBacSiDashboard._hoanTatKham()">Hoàn tất khám (nhảy hàng chờ)</button>
          </div>
        </div>
      </div>`;
  },

  async _moVeHoSoChiTiet() {
    if (!this._hoSoId) return;
    this._hoSoXemChiTietTraCuu = false;
    await this.chuyenTrang('ho-so');
    await this._loadChiTietHoSo(this._hoSoId, { traCuu: false });
  },

  async _hoanTatKham() {
    if (!this._hoSoId) {
      Toast.loi('Chưa có hồ sơ đang mở', '', 'error');
      return;
    }
    const hasLich = !!this._lichHenId;
    const ok = confirm(
      hasLich
        ? 'Kết thúc lịch hẹn (hoàn thành khám) và nhảy bệnh nhân khỏi hàng đang khám?\nChỉ làm sau khi đã chẩn đoán / kê đơn xong.'
        : 'Không có lịch gắn — chỉ đóng phiên xem hồ sơ trên màn hình bác sĩ. Tiếp tục?'
    );
    if (!ok) return;
    if (hasLich) {
      const res = await Http.tao(`/lich-hen/lich-hen/${this._lichHenId}/hoan_thanh/`, {});
      if (!res.ok) {
        Toast.loi('Không kết thúc được lịch', this._msgApiLoi(res), 'error');
        return;
      }
    }
    this._hoSoId = null;
    this._benhNhanId = null;
    this._benhNhanNguoiDungId = null;
    this._lichHenId = null;
    this._patientSnapshot = null;
    this._chanDoanDaLuu = false;
    this._refreshPatientStrip();
    Toast.hien('Đã hoàn tất', hasLich ? 'Lịch chuyển sang Hoàn thành.' : 'Đã đóng phiên làm việc.', 'success');
    await this.chuyenTrang('tong-quan');
  },

  /**
   * Danh sách hồ sơ: tìm theo mã BN / họ tên / SĐT và/hoặc khoảng ngày khám (tu_ngay, den_ngay).
   */
  async _dsHoSoTimKiem(q, tuNgay, denNgay) {
    const raw = (q || '').trim();
    const tu = (tuNgay || '').trim();
    const den = (denNgay || '').trim();
    if (!raw && !tu && !den) return { ok: false, list: [] };
    const params = new URLSearchParams({
      ordering: '-ngay_kham',
      page_size: '100',
    });
    if (raw) params.set('tim_kiem', raw);
    if (tu) params.set('tu_ngay', tu);
    if (den) params.set('den_ngay', den);
    const res = await Http.layDanhSach(`/benh-an/ho-so-benh-an/?${params}`);
    const rows = (res.data && res.data.results) || res.data || [];
    const list = Array.isArray(rows) ? rows : [];
    return { ok: res.ok, list };
  },

  _layBoLocTimHoSo() {
    const q = document.getElementById('bs-tim-bn')?.value?.trim() || '';
    const tuNgay = document.getElementById('bs-hs-tu-ngay')?.value?.trim() || '';
    const denNgay = document.getElementById('bs-hs-den-ngay')?.value?.trim() || '';
    return { q, tuNgay, denNgay };
  },

  _hsPresetHomNay() {
    const t = this._formatDateYMD(new Date());
    const elTu = document.getElementById('bs-hs-tu-ngay');
    const elDen = document.getElementById('bs-hs-den-ngay');
    if (elTu) elTu.value = t;
    if (elDen) elDen.value = t;
  },

  _hsPresetThangNay() {
    const d = new Date();
    const tu = this._formatDateYMD(new Date(d.getFullYear(), d.getMonth(), 1));
    const den = this._formatDateYMD(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const elTu = document.getElementById('bs-hs-tu-ngay');
    const elDen = document.getElementById('bs-hs-den-ngay');
    if (elTu) elTu.value = tu;
    if (elDen) elDen.value = den;
  },

  _hsXoaLocNgay() {
    const elTu = document.getElementById('bs-hs-tu-ngay');
    const elDen = document.getElementById('bs-hs-den-ngay');
    if (elTu) elTu.value = '';
    if (elDen) elDen.value = '';
  },

  async render() {
    const { hoTen, vaiTro } = Auth.layThongTin();
    const navHtml = `
      <button type="button" class="nav-item" data-bs-nav="tq" onclick="PageBacSiDashboard.chuyenTrang('tong-quan')"><i class="fas fa-chart-line"></i><span>Tổng quan</span></button>
      <button type="button" class="nav-item" data-bs-nav="hs" onclick="PageBacSiDashboard.chuyenTrang('ho-so')"><i class="fas fa-folder-open"></i><span>Hồ sơ bệnh nhân</span></button>
      <button type="button" class="nav-item" data-bs-nav="cd" onclick="PageBacSiDashboard.chuyenTrang('chan-doan')"><i class="fas fa-stethoscope"></i><span>Chẩn đoán</span></button>
      <button type="button" class="nav-item" data-bs-nav="dt" onclick="PageBacSiDashboard.chuyenTrang('don-thuoc')"><i class="fas fa-prescription"></i><span>Kê đơn</span></button>
      <button type="button" class="nav-item" data-bs-nav="cd2" onclick="PageBacSiDashboard.chuyenTrang('chi-dinh')"><i class="fas fa-syringe"></i><span>Tiêm chủng</span></button>
      <button type="button" class="nav-item" data-bs-nav="tk" onclick="PageBacSiDashboard.chuyenTrang('tai-kham')"><i class="fas fa-calendar-plus"></i><span>Lịch tái khám</span></button>`;
    const strip = `
      <div id="bs-patient-strip-wrap" class="mb-3">
        <div id="bs-patient-strip" class="card border-primary shadow-sm" style="display:none"></div>
      </div>`;
    window.RoleDashboardShell.mount('app-root', {
      brandTitle: 'PhòngKhám+',
      brandAccent: 'Bác sĩ',
      brandIcon: 'fa-user-md',
      navHtml,
      mainHostId: 'bac-si-main',
      userName: hoTen || 'Bác sĩ',
      userRoleLabel: vaiTro ? String(vaiTro).replace(/_/g, ' ') : 'Bác sĩ',
      contentMaxWidth: '1280px',
      aboveMainContent: strip,
    });
    await this.chuyenTrang('tong-quan');
  },

  _setNavActive(trang) {
    const map = {
      'tong-quan': 'tq',
      'ho-so': 'hs',
      'chan-doan': 'cd',
      'don-thuoc': 'dt',
      'chi-dinh': 'cd2',
      'tai-kham': 'tk',
    };
    const cur = map[trang];
    document.querySelectorAll('[data-bs-nav]').forEach((b) => {
      const on = b.getAttribute('data-bs-nav') === cur;
      b.classList.toggle('active', on);
    });
  },

  async chuyenTrang(trang) {
    this._setNavActive(trang);
    const host = 'bac-si-main';
    if (trang === 'tong-quan') await this._tongQuan(host);
    else if (trang === 'ho-so') await this._hoSoList(host);
    else if (trang === 'chan-doan') await this._formChanDoan(host);
    else if (trang === 'don-thuoc') await this._formDonThuoc(host);
    else if (trang === 'chi-dinh') await this._chiDinh(host);
    else if (trang === 'tai-kham') await this._formTaiKham(host);
    else await this._tongQuan(host);
    this._refreshPatientStrip();
  },

  async _tongQuan(host) {
    const res = await Http.layDanhSach('/lich-hen/lich-hen/dieu_phoi_hom_nay/');
    const results = (res.data && res.data.results) || [];
    UI.render(host, `
      <div class="card mb-3">
        <div class="card-header"><div class="card-title">Hàng chờ hôm nay (đã check-in)</div></div>
        <div class="card-body" id="bs-hang-cho"></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Gợi ý</div></div>
        <div class="card-body">
          <p class="text-muted small mb-0">Chọn bệnh nhân đã check-in để mở hồ sơ lần khám — không cần nhập mã BN. Hoặc vào <strong>Hồ sơ bệnh nhân</strong> để tìm theo mã, tên hoặc số điện thoại.</p>
        </div>
      </div>`);
    const el = document.getElementById('bs-hang-cho');
    if (!res.ok) {
      el.innerHTML = '<p class="text-danger">Không tải được danh sách.</p>';
      return;
    }
    el.innerHTML = results.length
      ? `<table class="table table-sm"><thead><tr><th>STT</th><th>Giờ</th><th>Bệnh nhân</th><th>Mã BN</th><th>Phòng</th><th></th></tr></thead><tbody>
        ${results
          .map(
            (l) => `<tr>
          <td>${this._esc(l.stt_trong_ngay ?? '—')}</td>
          <td>${this._esc((l.ngay_gio_hen || '').toString().slice(11, 16))}</td>
          <td>${this._esc(l.ten_benh_nhan || '')}</td>
          <td>${this._esc(l.ma_benh_nhan || '')}</td>
          <td>${this._esc(l.ma_phong || l.ten_phong || '—')}</td>
          <td>
            <button type="button" class="btn btn-sm btn-primary" onclick="PageBacSiDashboard._moHoSoTuLich('${l.id}')">Mở hồ sơ khám</button>
          </td>
        </tr>`
          )
          .join('')}
        </tbody></table>`
      : '<p class="text-muted">Chưa có bệnh nhân đã check-in hôm nay.</p>';
  },

  async _moHoSoTuLich(lichId) {
    const res = await Http.tao(`/lich-hen/lich-hen/${lichId}/mo_ho_so_benh_an/`, {});
    if (!res.ok || !res.data || !res.data.ho_so) {
      Toast.loi('Không mở được hồ sơ', (res.data && res.data.error) || '', 'error');
      return;
    }
    const ho = res.data.ho_so;
    this._lichHenId = lichId;
    this._hoSoId = ho.id;
    this._benhNhanId = this._idStr(ho.benh_nhan) || this._benhNhanId;
    this._chanDoanDaLuu = false;
    this._hoSoXemChiTietTraCuu = false;
    this._setPatientSnapshotFromHoSo(ho, lichId);
    Toast.hien('Đã mở hồ sơ', ho.ma_hs || '', 'success');
    await this.chuyenTrang('ho-so');
    await this._loadChiTietHoSo(this._hoSoId, { traCuu: false });
  },

  _trangThaiLich(tt) {
    const m = {
      CHO_XAC_NHAN: 'Chờ xác nhận',
      DA_DAT: 'Đã đặt',
      DA_XAC_NHAN: 'Đã xác nhận',
      CHECKED_IN: 'Đã check-in',
      DANG_KHAM: 'Đang khám',
      HOAN_THANH: 'Hoàn thành',
      DA_HUY: 'Đã hủy',
      VANG_MAT: 'Vắng mặt',
      QUA_HAN: 'Quá hạn',
    };
    return m[tt] || tt || '—';
  },

  async _loadDsLichHomNay() {
    const el = document.getElementById('bs-ds-hom-nay');
    if (!el) return;
    const res = await Http.layDanhSach(
      '/lich-hen/lich-hen/?hom_nay=true&ordering=ngay_gio_hen&page_size=100'
    );
    const rows = (res.data && res.data.results) || [];
    if (!res.ok) {
      el.innerHTML = '<p class="text-danger small mb-0">Không tải được danh sách lịch.</p>';
      return;
    }
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      el.innerHTML =
        '<p class="text-muted small mb-0">Không có lịch hôm nay được xếp cho bạn.</p>';
      return;
    }
    el.innerHTML = `<div class="table-responsive"><table class="table table-sm table-hover mb-0 align-middle">
      <thead><tr><th>Giờ</th><th>Bệnh nhân</th><th>Mã BN</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${list
        .map(
          (l) => `<tr>
        <td>${this._esc((l.ngay_gio_hen || '').toString().slice(11, 16))}</td>
        <td>${this._esc(l.ten_benh_nhan || '')}</td>
        <td>${this._esc(l.ma_benh_nhan || '')}</td>
        <td><span class="badge bg-light text-dark border">${this._esc(this._trangThaiLich(l.trang_thai))}</span></td>
        <td class="text-end">
          <button type="button" class="btn btn-sm btn-primary" onclick="PageBacSiDashboard._moHoSoTuLich('${l.id}')">Mở hồ sơ khám</button>
        </td>
      </tr>`
        )
        .join('')}
      </tbody></table></div>
      <p class="text-muted small mt-2 mb-0">Danh sách lịch <strong>hôm nay</strong> do lễ tân / hệ thống gán cho bác sĩ. Bấm &quot;Mở hồ sơ khám&quot; để tạo hoặc tiếp tục hồ sơ lần khám.</p>`;
  },

  async _hoSoList(host) {
    const qVal = this._esc((await this._guessTimTuBn()) || '');
    UI.render(host, `
      <div class="card mb-3">
        <div class="card-header"><div class="card-title">Lịch hôm nay (do lễ tân / hệ thống xếp)</div></div>
        <div class="card-body p-0" id="bs-ds-hom-nay"><p class="text-muted small p-3 mb-0">Đang tải…</p></div>
      </div>
      <div class="card bs-hs-card mb-0">
        <div class="card-header"><div class="card-title">Tìm hồ sơ bệnh nhân</div></div>
        <div class="card-body">
          <p class="bs-hs-intro">Nhập <strong>mã BN</strong>, <strong>họ tên</strong>, <strong>số điện thoại</strong> và/hoặc chọn <strong>ngày khám</strong> (từ — đến) rồi bấm Tìm.</p>
          <div class="bs-hs-search-row">
            <div class="bs-hs-input-wrap">
              <i class="fas fa-search bs-hs-input-icon" aria-hidden="true"></i>
              <input id="bs-tim-bn" class="form-control w-full" placeholder="VD: BN2024001, họ tên, số điện thoại…" value="${qVal}" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();PageBacSiDashboard._timHoSo();}"/>
            </div>
            <button type="button" class="bs-hs-btn-search" onclick="PageBacSiDashboard._timHoSo()"><i class="fas fa-search" aria-hidden="true"></i> Tìm</button>
          </div>
          <div class="bs-hs-date-row">
            <div class="bs-hs-date-field">
              <label class="bs-hs-date-label" for="bs-hs-tu-ngay">Từ ngày</label>
              <input type="date" id="bs-hs-tu-ngay" class="form-control bs-hs-date-input" onkeydown="if(event.key==='Enter'){event.preventDefault();PageBacSiDashboard._timHoSo();}"/>
            </div>
            <div class="bs-hs-date-field">
              <label class="bs-hs-date-label" for="bs-hs-den-ngay">Đến ngày</label>
              <input type="date" id="bs-hs-den-ngay" class="form-control bs-hs-date-input" onkeydown="if(event.key==='Enter'){event.preventDefault();PageBacSiDashboard._timHoSo();}"/>
            </div>
            <div class="bs-hs-date-presets">
              <button type="button" class="btn btn-sm btn-outline-secondary" onclick="PageBacSiDashboard._hsPresetHomNay()">Hôm nay</button>
              <button type="button" class="btn btn-sm btn-outline-secondary" onclick="PageBacSiDashboard._hsPresetThangNay()">Tháng này</button>
              <button type="button" class="btn btn-sm btn-outline-secondary" onclick="PageBacSiDashboard._hsXoaLocNgay()">Xóa ngày</button>
            </div>
          </div>
          <p class="bs-hs-hint">Có thể chỉ chọn ngày (không cần nhập tên) hoặc kết hợp cả hai. Danh sách kết quả có thanh cuộn khi nhiều lần khám.</p>
          <div id="bs-hs-pick" class="bs-hs-results"></div>
          <div id="bs-hs-detail"></div>
        </div>
      </div>`);
    await this._loadDsLichHomNay();
    if (qVal) await this._timHoSo();
  },

  async _guessTimTuBn() {
    if (!this._benhNhanId) return '';
    const res = await Http.layDanhSach(`/benh-nhan/${this._benhNhanId}/`);
    if (res.ok && res.data && res.data.ma_benh_nhan) return res.data.ma_benh_nhan;
    return '';
  },

  _renderHsPickList(list) {
    const rows = list
      .map(
        (h) => `<tr>
          <td><span class="bs-hs-code">${this._esc(h.ma_hs || '—')}</span></td>
          <td>${this._fmtNgayKhamDisplay(h.ngay_kham)}</td>
          <td><span class="bs-hs-patient">${this._esc(h.ten_benh_nhan || '—')}</span></td>
          <td><span class="bs-hs-code">${this._esc(h.ma_benh_nhan || '—')}</span></td>
          <td class="bs-hs-td-action">
            <button type="button" class="bs-hs-btn-view" onclick="PageBacSiDashboard._chonVaXemHoSo('${h.id}','${this._idStr(h.benh_nhan)}')">Xem hồ sơ</button>
          </td>
        </tr>`
      )
      .join('');
    return `
      <div class="bs-hs-results-head">
        <span class="bs-hs-results-title">Kết quả tìm kiếm</span>
        <span class="bs-hs-badge">${list.length} lần khám</span>
      </div>
      <div class="bs-hs-results-scroll" tabindex="0" aria-label="Danh sách lần khám">
        <div class="bs-hs-table-wrap">
          <table class="bs-hs-table">
            <thead>
              <tr>
                <th scope="col">Mã hồ sơ</th>
                <th scope="col">Ngày khám</th>
                <th scope="col">Bệnh nhân</th>
                <th scope="col">Mã BN</th>
                <th scope="col" class="bs-hs-th-action">Thao tác</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  },

  async _timHoSo() {
    let { q, tuNgay, denNgay } = this._layBoLocTimHoSo();
    if (!q && !tuNgay && !denNgay) {
      return Toast.loi('Nhập mã BN / tên / SĐT hoặc chọn ngày khám', '', 'error');
    }
    if (tuNgay && !denNgay) denNgay = tuNgay;
    if (denNgay && !tuNgay) tuNgay = denNgay;
    if (tuNgay && denNgay && tuNgay > denNgay) {
      return Toast.loi('Từ ngày không được sau đến ngày', '', 'error');
    }
    const box = document.getElementById('bs-hs-pick');
    if (!box) return;
    box.innerHTML = '<p class="text-muted small py-3 mb-0 text-center">Đang tải…</p>';
    const { ok, list } = await this._dsHoSoTimKiem(q, tuNgay, denNgay);
    if (!ok) {
      box.innerHTML = `<div class="bs-hs-error" role="alert">
        <i class="fas fa-exclamation-circle" style="font-size:22px;margin-bottom:10px;opacity:.9" aria-hidden="true"></i>
        <span>Không tải được danh sách. Kiểm tra kết nối hoặc thử lại sau.</span>
      </div>`;
      return;
    }
    if (!list.length) {
      box.innerHTML = `<div class="bs-hs-empty">
        <i class="fas fa-folder-open" style="font-size:32px;margin-bottom:10px;opacity:.25" aria-hidden="true"></i>
        <span style="font-weight:600;color:var(--c-text-secondary)">Không có hồ sơ phù hợp</span>
        <span style="font-size:12px;margin-top:6px;max-width:320px">Thử từ khóa khác hoặc đổi khoảng ngày khám.</span>
      </div>`;
      return;
    }
    if (list[0].benh_nhan) this._benhNhanId = this._idStr(list[0].benh_nhan);
    box.innerHTML = this._renderHsPickList(list);
  },

  _chonVaXemHoSo(hoSoId, benhNhanId) {
    this._hoSoXemChiTietTraCuu = true;
    this._refreshPatientStrip();
    this._loadChiTietHoSo(hoSoId, { traCuu: true });
  },

  _dongChiTietTraCuu() {
    this._hoSoXemChiTietTraCuu = false;
    const d = document.getElementById('bs-hs-detail');
    if (d) d.innerHTML = '';
    this._refreshPatientStrip();
  },

  _chonHoSo(hoSoId, benhNhanId) {
    this._hoSoId = hoSoId;
    if (benhNhanId) this._benhNhanId = this._idStr(benhNhanId);
  },

  async _loadChiTietHoSo(hoSoId, opts = {}) {
    const traCuu = !!opts.traCuu;
    const id = (hoSoId || '').trim();
    if (!id) return Toast.loi('Thiếu hồ sơ', '', 'error');
    const res = await Http.layDanhSach(`/benh-an/ho-so-benh-an/${id}/`);
    const d = document.getElementById('bs-hs-detail');
    if (!d) return;
    if (!res.ok || !res.data) {
      d.innerHTML = '<p class="text-danger">Không đọc được hồ sơ.</p>';
      return;
    }
    const h = res.data;

    if (traCuu) {
      this._hoSoXemChiTietTraCuu = true;
      d.innerHTML = this._renderHoSoTomTatTraCuu(h);
      this._refreshPatientStrip();
      try {
        d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {
        d.scrollIntoView();
      }
      return;
    }

    this._hoSoXemChiTietTraCuu = false;
    this._hoSoId = id;
    if (h.benh_nhan && typeof h.benh_nhan === 'object') {
      this._benhNhanId = this._idStr(h.benh_nhan.id || h.benh_nhan);
      const nd = h.benh_nhan.nguoi_dung;
      this._benhNhanNguoiDungId =
        typeof nd === 'object' && nd && nd.id ? nd.id : nd || h.benh_nhan.nguoi_dung_id || null;
    } else if (h.benh_nhan) {
      this._benhNhanId = this._idStr(h.benh_nhan);
      this._benhNhanNguoiDungId = null;
    }
    await this._dongBoLichHenTuHoSo(id);
    this._setPatientSnapshotFromHoSo(h, this._lichHenId);
    this._refreshPatientStrip();
    d.innerHTML = this._renderHoSoTomTat(h);
  },

  /** Gắn đúng lịch hẹn với hồ sơ đang mở (tránh ID lịch cũ / nhầm BN sau khi tìm kiếm). */
  async _dongBoLichHenTuHoSo(hoSoId) {
    const lkRes = await Http.layDanhSach(
      `/lich-hen/lich-kham/?ho_so_benh_an=${encodeURIComponent(hoSoId)}`
    );
    let lhId = null;
    if (lkRes.ok && lkRes.data != null) {
      const raw = lkRes.data;
      const rows = Array.isArray(raw) ? raw : raw.results || [];
      const row = rows[0];
      if (row && row.lich_hen != null && row.lich_hen !== '') {
        lhId = typeof row.lich_hen === 'object' && row.lich_hen !== null ? row.lich_hen.id : row.lich_hen;
      }
    }
    this._lichHenId = lhId;
  },

  _fmtNgayKhamDisplay(s) {
    const t = (s == null ? '' : String(s)).trim();
    if (!t) return '—';
    return this._esc(t.replace('T', ' ').slice(0, 16));
  },

  _shortText(s, max) {
    const t = (s == null ? '' : String(s)).trim();
    if (!t) return '';
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
  },

  _tomTatChanDoan(chan) {
    if (!chan) return '';
    if (typeof chan === 'string') return this._shortText(chan, 280);
    const o = chan;
    const parts = [
      o.mo_ta,
      o.mo_ta_chan_doan,
      o.benh_chinh,
      o.chan_doan_chinh,
      o.ma_icd10,
      o.icd10,
    ].filter((x) => x != null && String(x).trim() !== '');
    if (parts.length) return this._shortText(parts.map(String).join(' · '), 280);
    try {
      return this._shortText(JSON.stringify(chan), 280);
    } catch (e) {
      return '';
    }
  },

  _renderChanDoanDocHtml(chan) {
    if (!chan) {
      return '<p class="bs-hs-dd-muted small mb-0">Chưa có chẩn đoán trên hồ sơ này.</p>';
    }
    if (typeof chan === 'string') {
      return `<p class="small mb-0">${this._esc(chan)}</p>`;
    }
    const pairs = [
      ['Tên bệnh', chan.ten_benh],
      ['Mã ICD-10', chan.ma_icd10],
      ['Mô tả', chan.mo_ta],
      ['Kết luận', chan.ket_luan],
      ['Phương pháp điều trị', chan.phuong_phap_dieu_tri],
      ['Ghi chú', chan.ghi_chu],
    ].filter(([, v]) => v != null && String(v).trim() !== '');
    if (!pairs.length) {
      const fallback = this._tomTatChanDoan(chan);
      return fallback
        ? `<p class="small mb-0">${this._esc(fallback)}</p>`
        : '<p class="bs-hs-dd-muted small mb-0">Chưa có chẩn đoán.</p>';
    }
    return `<dl class="bs-hs-dl">${pairs
      .map(
        ([k, v]) =>
          `<dt>${this._esc(k)}</dt><dd>${this._esc(this._shortText(String(v), 800))}</dd>`
      )
      .join('')}</dl>`;
  },

  _renderToaThuocDocHtml(h) {
    const dons = Array.isArray(h.don_thuoc) ? h.don_thuoc : [];
    if (!dons.length) {
      return '<p class="bs-hs-dd-muted small mb-0">Chưa có toa thuốc trên hồ sơ này.</p>';
    }
    return dons
      .map((don) => {
        const ma = this._esc(don.ma_don || '');
        const chuan = don.chuan_doan ? this._esc(this._shortText(don.chuan_doan, 200)) : '';
        const cts = Array.isArray(don.chi_tiet) ? don.chi_tiet : [];
        const body = cts.length
          ? `<table class="table table-sm table-bordered mb-0 small"><thead><tr><th>Thuốc</th><th>SL</th><th>Liều / cách dùng</th></tr></thead><tbody>${cts
              .map((ct) => {
                const ten = this._esc(ct.ten_thuoc || ct.ten_thuoc_tu_do || '');
                const sl = ct.so_luong != null ? this._esc(String(ct.so_luong)) : '—';
                const lieu = (ct.lieu_dung || '').trim();
                const cach = (ct.cach_dung_display || ct.cach_dung || '').toString().trim();
                const thoi = (ct.thoi_diem_display || ct.thoi_diem || '').toString().trim();
                const cdRaw = [lieu, cach, thoi].filter(Boolean).join(' · ');
                return `<tr><td>${ten}</td><td>${sl}</td><td>${cdRaw ? this._esc(cdRaw) : '—'}</td></tr>`;
              })
              .join('')}</tbody></table>`
          : '<p class="text-muted small mb-0">Đơn chưa có dòng thuốc.</p>';
        return `<div class="bs-hs-toa-block"><div class="small fw-semibold mb-1">Toa ${ma}${chuan ? ` <span class="text-muted fw-normal">— ${chuan}</span>` : ''}</div>${body}</div>`;
      })
      .join('');
  },

  _renderHoSoTomTatTraCuu(h) {
    const bn = typeof h.benh_nhan === 'object' ? h.benh_nhan : null;
    const tenBn = (bn && (bn.ho_ten || bn.nguoi_dung?.ho_ten)) || h.ten_benh_nhan || '';
    const maBn = (bn && bn.ma_benh_nhan) || h.ma_benh_nhan || '';
    const sdt = (bn && (bn.so_dien_thoai || bn.nguoi_dung?.so_dien_thoai)) || '';
    const initial = this._esc(((tenBn || '?').trim().charAt(0) || '?').toUpperCase());
    const ngayStr = this._fmtNgayKhamDisplay(h.ngay_kham);
    const chips = [];
    if (maBn) chips.push(`<span class="bs-hs-chip">Mã BN · ${this._esc(maBn)}</span>`);
    if (sdt) chips.push(`<span class="bs-hs-chip">ĐT · ${this._esc(sdt)}</span>`);
    if (bn && (bn.ngay_sinh || bn.gioi_tinh)) {
      chips.push(
        `<span class="bs-hs-chip">${this._esc([bn.ngay_sinh, bn.gioi_tinh].filter(Boolean).join(' · '))}</span>`
      );
    }

    return `
      <div class="bs-hs-detail bs-hs-detail--readonly">
        <div class="bs-hs-detail-head">
          <div class="bs-hs-detail-identity">
            <div class="bs-hs-detail-avatar" aria-hidden="true">${initial}</div>
            <div class="bs-hs-detail-meta">
              <div class="d-flex flex-wrap align-items-center gap-2">
                <div class="bs-hs-detail-ma">${this._esc(h.ma_hs || '')}</div>
                <span class="bs-hs-badge-readonly">Chỉ xem — tra cứu</span>
              </div>
              <div class="bs-hs-detail-name">${this._esc(tenBn || '—')}</div>
              <div class="bs-hs-detail-chips">${chips.join('')}</div>
              <div class="text-muted small mt-1">Ngày khám: ${ngayStr}</div>
            </div>
          </div>
          <div class="bs-hs-detail-actions">
            <button type="button" class="btn btn-sm btn-outline-secondary" onclick="PageBacSiDashboard._dongChiTietTraCuu()">Tắt</button>
          </div>
        </div>
        <div class="bs-hs-detail-body">
          <section class="bs-hs-readonly-section">
            <h4 class="bs-hs-readonly-title">Chẩn đoán</h4>
            ${this._renderChanDoanDocHtml(h.chan_doan)}
          </section>
          <section class="bs-hs-readonly-section">
            <h4 class="bs-hs-readonly-title">Toa thuốc đã kê</h4>
            ${this._renderToaThuocDocHtml(h)}
          </section>
        </div>
      </div>`;
  },

  _renderHoSoTomTat(h) {
    const bn = typeof h.benh_nhan === 'object' ? h.benh_nhan : null;
    const tenBn = (bn && (bn.ho_ten || bn.nguoi_dung?.ho_ten)) || h.ten_benh_nhan || '';
    const maBn = (bn && bn.ma_benh_nhan) || h.ma_benh_nhan || '';
    const sdt = (bn && (bn.so_dien_thoai || bn.nguoi_dung?.so_dien_thoai)) || '';
    const chanLine = this._tomTatChanDoan(h.chan_doan);
    const donN = Array.isArray(h.don_thuoc) ? h.don_thuoc.length : 0;
    const initial = this._esc(((tenBn || '?').trim().charAt(0) || '?').toUpperCase());
    const ngayStr = this._fmtNgayKhamDisplay(h.ngay_kham);
    const chips = [];
    if (maBn) chips.push(`<span class="bs-hs-chip">Mã BN · ${this._esc(maBn)}</span>`);
    if (sdt) chips.push(`<span class="bs-hs-chip">Điện thoại · ${this._esc(sdt)}</span>`);
    if (bn && (bn.ngay_sinh || bn.gioi_tinh)) {
      chips.push(
        `<span class="bs-hs-chip">${this._esc([bn.ngay_sinh, bn.gioi_tinh].filter(Boolean).join(' · '))}</span>`
      );
    }

    return `
      <div class="bs-hs-detail">
        <div class="bs-hs-detail-head">
          <div class="bs-hs-detail-identity">
            <div class="bs-hs-detail-avatar" aria-hidden="true">${initial}</div>
            <div class="bs-hs-detail-meta">
              <div class="bs-hs-detail-ma">${this._esc(h.ma_hs || '')}</div>
              <div class="bs-hs-detail-name">${this._esc(tenBn || '—')}</div>
              <div class="bs-hs-detail-chips">${chips.join('')}</div>
            </div>
          </div>
          <div class="bs-hs-detail-actions">
            <button type="button" class="btn btn-primary" onclick="PageBacSiDashboard._chuyenNhapChanDoan()">Nhập chẩn đoán</button>
            <button type="button" class="btn btn-outline-primary" onclick="PageBacSiDashboard.chuyenTrang('don-thuoc')">Kê đơn</button>
            <button type="button" class="btn btn-outline-primary" onclick="PageBacSiDashboard.chuyenTrang('chi-dinh')">Tiêm chủng</button>
            <button type="button" class="btn btn-outline-secondary" onclick="PageBacSiDashboard._henTaiKhamNhanh()">Hẹn tái khám</button>
            <button type="button" class="btn btn-outline-danger" onclick="PageBacSiDashboard._hoanTatKham()">Hoàn tất khám</button>
          </div>
        </div>
        <div class="bs-hs-detail-body">
          <dl class="bs-hs-dl">
            <dt>Ngày khám</dt><dd>${ngayStr}</dd>
            <dt>Lý do khám</dt><dd>${this._esc(this._shortText(h.ly_do_kham, 400) || '—')}</dd>
            <dt>Triệu chứng</dt><dd>${this._esc(this._shortText(h.trieu_chung, 400) || '—')}</dd>
            <dt>KQ khám lâm sàng</dt><dd>${this._esc(this._shortText(h.ket_qua_kham_lam_sang, 400) || '—')}</dd>
            <dt>Chẩn đoán</dt><dd>${chanLine ? this._esc(chanLine) : '<span class="bs-hs-dd-muted">Chưa ghi chẩn đoán</span>'}</dd>
            <dt>Đơn thuốc</dt><dd>${donN ? `${donN} đơn` : '<span class="bs-hs-dd-muted">Chưa có</span>'}</dd>
          </dl>
          ${bn && bn.dia_chi ? `<div class="bs-hs-detail-footer"><strong>Địa chỉ</strong> — ${this._esc(this._shortText(bn.dia_chi, 300))}</div>` : ''}
        </div>
      </div>`;
  },

  async _chuyenNhapChanDoan() {
    if (!this._hoSoId) {
      Toast.loi('Chưa mở hồ sơ', '', 'error');
      return;
    }
    await this.chuyenTrang('chan-doan');
  },

  async _henTaiKhamNhanh() {
    if (!this._hoSoId || !this._benhNhanId) {
      Toast.loi(
        'Chưa chọn hồ sơ / bệnh nhân',
        'Mở hồ sơ từ Tổng quan hoặc tab Hồ sơ bệnh nhân trước.',
        'error'
      );
      return;
    }
    const bs = this._bacSiId();
    if (!bs) return Toast.loi('Không lấy được mã bác sĩ', '', 'error');

    this._dongModalHenTaiKham();
    const defDt = this._defaultTaiKhamDatetimeLocal();
    const overlay = document.createElement('div');
    overlay.id = 'bs-hen-tk-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    overlay.innerHTML = `
      <div class="card shadow" style="max-width:440px;width:100%;max-height:90vh;overflow:auto">
        <div class="card-header d-flex justify-content-between align-items-center py-2">
          <span class="card-title mb-0">Đặt lịch hẹn tái khám</span>
          <button type="button" class="btn btn-sm btn-light border" title="Đóng" onclick="PageBacSiDashboard._dongModalHenTaiKham()">×</button>
        </div>
        <div class="card-body">
          <p class="small text-muted mb-2">Bệnh nhân đang mở — hồ sơ gắn với lần khám hiện tại.</p>
          <label class="small">Ngày giờ tái khám</label>
          <input type="datetime-local" id="bs-hen-tk-ngay" class="form-control form-control-sm mb-2" value="${this._esc(defDt)}" />
          <label class="small">Lý do tái khám</label>
          <textarea id="bs-hen-tk-ly" class="form-control form-control-sm mb-2" rows="2">Tái khám theo hẹn</textarea>
          <label class="small">Ghi chú (tuỳ chọn)</label>
          <textarea id="bs-hen-tk-gc" class="form-control form-control-sm mb-3" rows="2" placeholder="Ghi chú nội bộ"></textarea>
          <div class="d-flex gap-2 justify-content-end flex-wrap">
            <button type="button" class="btn btn-outline-secondary btn-sm" onclick="PageBacSiDashboard._dongModalHenTaiKham()">Huỷ</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="PageBacSiDashboard._guiHenTaiKhamModal()">Lưu lịch</button>
          </div>
        </div>
      </div>`;
    overlay.onclick = (ev) => {
      if (ev.target === overlay) this._dongModalHenTaiKham();
    };
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('bs-hen-tk-ngay')?.focus(), 50);
  },

  async _guiHenTaiKhamModal() {
    const ngayRaw = document.getElementById('bs-hen-tk-ngay')?.value;
    const ly = (document.getElementById('bs-hen-tk-ly')?.value || '').trim() || 'Tái khám';
    const gc = (document.getElementById('bs-hen-tk-gc')?.value || '').trim();
    const ngay = this._localDatetimeToNgayHenApi(ngayRaw);
    if (!ngay) {
      Toast.loi('Chọn ngày giờ', '', 'error');
      return;
    }
    if (!this._hoSoId || !this._benhNhanId) return;
    const bs = this._bacSiId();
    if (!bs) return Toast.loi('Không lấy được mã bác sĩ', '', 'error');
    const body = {
      benh_nhan: this._idStr(this._benhNhanId),
      ho_so: this._hoSoId,
      bac_si: bs,
      ngay_hen: ngay,
      ly_do: ly,
      ghi_chu: gc,
    };
    const res = await Http.tao('/benh-an/lich-hen-tai-kham/', body);
    if (res.ok) {
      this._dongModalHenTaiKham();
      Toast.hien('Đã tạo lịch tái khám', (res.data && res.data.ma_hen) || '', 'success');
      const main = document.getElementById('bac-si-main');
      if (main && main.querySelector('#bs-tk-bang')) await this._taiKhamLoad();
    } else Toast.loi('Không tạo được', this._msgApiLoi(res), 'error');
  },

  async _formTaiKham(host) {
    const tu0 = this._formatDateYMD(new Date());
    const dn = new Date();
    dn.setDate(dn.getDate() + 60);
    const den0 = this._formatDateYMD(dn);
    UI.render(host, `
      <div class="card mb-3">
        <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div class="card-title mb-0">Lịch hẹn tái khám của bạn</div>
          <button type="button" class="btn btn-sm btn-primary" onclick="PageBacSiDashboard._henTaiKhamNhanh()">Đặt lịch cho BN đang mở</button>
        </div>
        <div class="card-body">
          <div class="row g-2 align-items-end mb-3">
            <div class="col-auto">
              <label class="small d-block">Từ ngày</label>
              <input type="date" id="bs-tk-tu" class="form-control form-control-sm" value="${this._esc(tu0)}" />
            </div>
            <div class="col-auto">
              <label class="small d-block">Đến ngày</label>
              <input type="date" id="bs-tk-den" class="form-control form-control-sm" value="${this._esc(den0)}" />
            </div>
            <div class="col-auto">
              <button type="button" class="btn btn-sm btn-outline-primary" onclick="PageBacSiDashboard._taiKhamLoad()">Tải danh sách</button>
            </div>
            <div class="col-auto">
              <button type="button" class="btn btn-sm btn-outline-secondary" onclick="PageBacSiDashboard._taiKhamPresetHomNay()">Hôm nay</button>
            </div>
            <div class="col-auto">
              <button type="button" class="btn btn-sm btn-outline-secondary" onclick="PageBacSiDashboard._taiKhamPresetTuan()">7 ngày tới</button>
            </div>
          </div>
          <div id="bs-tk-bang"></div>
        </div>
      </div>
      <p class="text-muted small">Đặt lịch từ tóm tắt hồ sơ hoặc màn <strong>Chẩn đoán</strong> khi đang mở bệnh nhân. Giờ theo múi giờ hệ thống.</p>
    `);
    await this._taiKhamLoad();
  },

  _taiKhamPresetHomNay() {
    const t = this._formatDateYMD(new Date());
    const elTu = document.getElementById('bs-tk-tu');
    const elDen = document.getElementById('bs-tk-den');
    if (elTu) elTu.value = t;
    if (elDen) elDen.value = t;
    this._taiKhamLoad();
  },

  _taiKhamPresetTuan() {
    const a = new Date();
    const b = new Date();
    b.setDate(b.getDate() + 7);
    const elTu = document.getElementById('bs-tk-tu');
    const elDen = document.getElementById('bs-tk-den');
    if (elTu) elTu.value = this._formatDateYMD(a);
    if (elDen) elDen.value = this._formatDateYMD(b);
    this._taiKhamLoad();
  },

  async _taiKhamLoad() {
    const el = document.getElementById('bs-tk-bang');
    if (!el) return;
    const tu = document.getElementById('bs-tk-tu')?.value;
    const den = document.getElementById('bs-tk-den')?.value;
    if (!tu || !den) {
      el.innerHTML = '<p class="text-danger small">Chọn đủ từ ngày và đến ngày.</p>';
      return;
    }
    if (tu > den) {
      el.innerHTML = '<p class="text-danger small">Từ ngày không được sau đến ngày.</p>';
      return;
    }
    const qs = new URLSearchParams({
      ordering: 'ngay_hen',
      page_size: '200',
      tu_ngay: tu,
      den_ngay: den,
    });
    el.innerHTML = '<p class="text-muted small mb-0">Đang tải…</p>';
    const res = await Http.layDanhSach(`/benh-an/lich-hen-tai-kham/?${qs}`);
    const rows = (res.data && res.data.results) || res.data || [];
    const list = Array.isArray(rows) ? rows : [];
    if (!res.ok) {
      el.innerHTML = `<p class="text-danger small">Không tải được: ${this._esc(this._msgApiLoi(res))}</p>`;
      return;
    }
    if (!list.length) {
      el.innerHTML = '<p class="text-muted small mb-0">Không có lịch trong khoảng đã chọn.</p>';
      return;
    }
    el.innerHTML = `<div class="table-responsive"><table class="table table-sm table-hover mb-0 align-middle">
      <thead><tr><th>Ngày giờ</th><th>Bệnh nhân</th><th>Mã BN</th><th>Mã HS</th><th>Lý do</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${list
        .map((r) => {
          const id = r.id;
          const tgn = (r.ngay_hen || '').toString().slice(0, 16);
          const actions =
            r.trang_thai === 'CHUA_KHAM'
              ? `<button type="button" class="btn btn-sm btn-success" onclick="PageBacSiDashboard._capNhatTaiKhamTT('${id}','DA_KHAM')">Đã khám</button> <button type="button" class="btn btn-sm btn-outline-danger" onclick="PageBacSiDashboard._capNhatTaiKhamTT('${id}','HUY')">Huỷ</button>`
              : '—';
          return `<tr>
          <td>${this._esc(tgn)}</td>
          <td>${this._esc(r.ten_benh_nhan || '')}</td>
          <td>${this._esc(r.ma_benh_nhan || '')}</td>
          <td>${this._esc(r.ma_hs || '')}</td>
          <td>${this._esc(this._shortText(r.ly_do, 80))}</td>
          <td><span class="badge bg-light text-dark border">${this._esc(this._trangThaiTaiKham(r.trang_thai))}</span></td>
          <td class="text-nowrap text-end">${actions}</td>
        </tr>`;
        })
        .join('')}
    </tbody></table></div>`;
  },

  async _capNhatTaiKhamTT(id, trangThai) {
    if (!id) return;
    const res = await Http.tao(`/benh-an/lich-hen-tai-kham/${id}/cap_nhat_trang_thai/`, {
      trang_thai: trangThai,
    });
    if (res.ok) {
      Toast.hien('Đã cập nhật', '', 'success');
      await this._taiKhamLoad();
    } else Toast.loi('Không cập nhật được', this._msgApiLoi(res), 'error');
  },

  async _formChanDoan(host) {
    const hid = this._esc(this._hoSoId || '');
    const ps = this._patientSnapshot;
    const hasHoSo = !!this._hoSoId;
    const hdr =
      ps && ps.tenBn
        ? `<p class="small fw-semibold text-primary mb-2">${this._esc(ps.tenBn)} — Mã BN ${this._esc(ps.maBn)} — HS ${this._esc(ps.maHs)}</p>`
        : '';
    const khoiTimKiem =
      hasHoSo && hid
        ? `<div class="alert alert-light border py-2 mb-3 small mb-2">
            <div class="mt-1">Mã hồ sơ: <code id="bs-cd-hsid" class="user-select-all">${hid}</code>
            ${ps?.maBn ? ` — Mã BN: <strong>${this._esc(ps.maBn)}</strong>` : ''}
            </div>
            <input type="hidden" id="cd-hsid-fixed" value="${this._esc(this._hoSoId)}" />
            <details class="mb-3"><summary class="small text-muted" style="cursor:pointer">Tìm hồ sơ bệnh nhân khác (đổi BN)</summary>
              <div class="pt-2">
                <label class="small">Mã BN, tên hoặc SĐT</label>
                <div class="input-group input-group-sm mb-2">
                  <input id="cd-q" class="form-control" placeholder="Tìm..."/>
                  <button type="button" class="btn btn-outline-primary" onclick="PageBacSiDashboard._cdTimHoSo()">Tải</button>
                </div>
                <label class="small">Chọn lần khám</label>
                <select id="cd-hsid" class="form-control form-control-sm"></select>
              </div>
            </details>`
        : `<p class="small text-muted mb-2">Chưa có hồ sơ — mở từ <strong>Tổng quan</strong> hoặc tìm bên dưới. Hồ sơ: <code id="bs-cd-hsid">${hid || '—'}</code></p>
            <div class="mb-2">
              <label class="small">Tìm hồ sơ (mã BN, tên, SĐT)</label>
              <div class="input-group input-group-sm">
                <input id="cd-q" class="form-control" placeholder="Mã BN, tên, SĐT"/>
                <button type="button" class="btn btn-outline-primary" onclick="PageBacSiDashboard._cdTimHoSo()">Tải hồ sơ</button>
              </div>
            </div>
            <div class="mb-2">
              <label class="small">Hồ sơ lần khám</label>
              <select id="cd-hsid" class="form-control form-control-sm"></select>
            </div>`;
    UI.render(host, `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;align-items:start">
        <div class="card">
          <div class="card-header"><div class="card-title">Lịch đã check-in (hôm nay)</div></div>
          <div class="card-body" id="bs-cd-lich"></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Chẩn đoán (gắn lần khám hiện tại)</div></div>
          <div class="card-body">
            ${hdr}
            ${khoiTimKiem}
            <label class="small">Triệu chứng</label>
            <textarea id="cd-tc" class="form-control form-control-sm mb-2" rows="2" placeholder="Triệu chứng"></textarea>
            <label class="small">Kết quả khám lâm sàng</label>
            <textarea id="cd-kqls" class="form-control form-control-sm mb-2" rows="2" placeholder="Kết quả khám lâm sàng"></textarea>
            <label class="small">Mã ICD-10 (tuỳ chọn)</label>
            <input id="cd-icd" class="form-control form-control-sm mb-2" placeholder="VD: J00"/>
            <label class="small">Tên bệnh</label>
            <input id="cd-ten" class="form-control form-control-sm mb-2" placeholder="Bắt buộc"/>
            <label class="small">Mô tả</label>
            <textarea id="cd-mo" class="form-control form-control-sm mb-2" rows="2"></textarea>
            <label class="small">Kết luận</label>
            <textarea id="cd-kl" class="form-control form-control-sm mb-2" rows="2"></textarea>
            <button type="button" class="btn btn-primary" onclick="PageBacSiDashboard._guiChanDoan()">Lưu chẩn đoán</button>
            <div id="bs-cd-next" class="mt-3 pt-3 border-top" style="display:none">
              <div class="small text-muted mb-2">Thao tác tiếp theo</div>
              <div class="d-flex flex-wrap gap-2">
                <button type="button" class="btn btn-sm btn-success" onclick="PageBacSiDashboard.chuyenTrang('don-thuoc')">Kê đơn thuốc</button>
                <button type="button" class="btn btn-sm btn-info text-white" onclick="PageBacSiDashboard.chuyenTrang('chi-dinh')">Tiêm chủng</button>
                <button type="button" class="btn btn-sm btn-secondary" onclick="PageBacSiDashboard._henTaiKhamNhanh()">Hẹn tái khám</button>
              </div>
            </div>
            <pre id="cd-out" class="mt-3 small text-muted" style="white-space:pre-wrap"></pre>
          </div>
        </div>
      </div>`);
    await this._cdLoadLichCheckIn();
    await this._cdSyncSelectHoSo();
  },

  async _cdLoadLichCheckIn() {
    const el = document.getElementById('bs-cd-lich');
    if (!el) return;
    const res = await Http.layDanhSach('/lich-hen/lich-hen/dieu_phoi_hom_nay/');
    const results = (res.data && res.data.results) || [];
    el.innerHTML = res.ok && results.length
      ? `<ul class="list-group list-group-flush small">${results
          .map(
            (l) => `<li class="list-group-item px-0 d-flex justify-content-between gap-2 align-items-start">
          <span>${this._esc(l.ten_benh_nhan)} — <span class="text-muted">${this._esc(l.ma_benh_nhan)}</span><br/><span class="text-muted">STT ${this._esc(String(l.stt_trong_ngay ?? '—'))}</span></span>
          <button type="button" class="btn btn-sm btn-primary" onclick="PageBacSiDashboard._moHoSoTuLichChanDoan('${l.id}')">Mở hồ sơ</button>
        </li>`
          )
          .join('')}</ul>`
      : '<p class="text-muted small mb-0">Không có lịch check-in.</p>';
  },

  async _moHoSoTuLichChanDoan(lichId) {
    await this._moHoSoTuLich(lichId);
    await this.chuyenTrang('chan-doan');
    await this._cdSyncSelectHoSo();
  },

  async _cdTimHoSo() {
    const q = document.getElementById('cd-q')?.value?.trim();
    if (!q) return Toast.loi('Nhập mã BN, tên hoặc SĐT', '', 'error');
    const { ok, list } = await this._dsHoSoTimKiem(q);
    const sel = document.getElementById('cd-hsid');
    if (!sel) return;
    if (!ok || !list.length) {
      sel.innerHTML = '<option value="">Không có hồ sơ</option>';
      return Toast.loi('Không tìm thấy hồ sơ', '', 'error');
    }
    if (list[0].benh_nhan) this._benhNhanId = this._idStr(list[0].benh_nhan);
    sel.innerHTML = list
      .map(
        (h) =>
          `<option value="${this._esc(h.id)}">${this._esc(h.ma_hs)} — ${this._esc((h.ngay_kham || '').toString().slice(0, 16))}</option>`
      )
      .join('');
    sel.value = list[0].id;
    this._hoSoId = list[0].id;
    const hsl = document.getElementById('bs-cd-hsid');
    if (hsl) hsl.textContent = this._hoSoId;
    const fx = document.getElementById('cd-hsid-fixed');
    if (fx) fx.value = this._hoSoId;
    await this._cdFillTuHoSo();
  },

  async _cdSyncSelectHoSo() {
    this._benhNhanId = this._idStr(this._benhNhanId);
    const bnId = this._benhNhanId;
    const sel = document.getElementById('cd-hsid');
    if (!sel) return;

    const bindChange = () => {
      sel.onchange = () => {
        this._hoSoId = sel.value || null;
        const hsl = document.getElementById('bs-cd-hsid');
        if (hsl) hsl.textContent = this._hoSoId || '—';
        const fx = document.getElementById('cd-hsid-fixed');
        if (fx && this._hoSoId) fx.value = this._hoSoId;
        this._cdFillTuHoSo();
      };
    };

    if (!bnId && this._hoSoId) {
      sel.innerHTML = `<option value="${this._esc(this._hoSoId)}">Hồ sơ đang mở</option>`;
      sel.value = this._hoSoId;
      bindChange();
      const hsl = document.getElementById('bs-cd-hsid');
      if (hsl) hsl.textContent = this._hoSoId || '—';
      await this._cdFillTuHoSo();
      return;
    }

    if (!bnId) {
      sel.innerHTML = '<option value="">— Chọn hồ sơ —</option>';
      bindChange();
      return;
    }

    const res = await Http.layDanhSach(
      `/benh-an/ho-so-benh-an/?benh_nhan=${encodeURIComponent(bnId)}&ordering=-ngay_kham&page_size=50`
    );
    const rows = (res.data && res.data.results) || res.data || [];
    const list = Array.isArray(rows) ? rows : [];
    sel.innerHTML =
      '<option value="">— Chọn —</option>' +
      list.map((h) => `<option value="${h.id}">${this._esc(h.ma_hs)} — ${this._esc((h.ngay_kham || '').toString().slice(0, 16))}</option>`).join('');
    if (this._hoSoId) {
      sel.value = this._hoSoId;
      if (sel.value !== this._hoSoId) sel.appendChild(new Option(`Hồ sơ ${this._hoSoId}`, this._hoSoId, true, true));
    }
    bindChange();
    const hsl2 = document.getElementById('bs-cd-hsid');
    if (hsl2) hsl2.textContent = this._hoSoId || '—';
    await this._cdFillTuHoSo();
  },

  async _cdFillTuHoSo() {
    if (!this._hoSoId) return;
    const res = await Http.layDanhSach(`/benh-an/ho-so-benh-an/${this._hoSoId}/`);
    if (!res.ok || !res.data) return;
    const h = res.data;
    this._setPatientSnapshotFromHoSo(h, this._lichHenId);
    this._refreshPatientStrip();
    const cd = h.chan_doan;
    const tc = document.getElementById('cd-tc');
    const kqls = document.getElementById('cd-kqls');
    const icd = document.getElementById('cd-icd');
    const ten = document.getElementById('cd-ten');
    const mo = document.getElementById('cd-mo');
    const kl = document.getElementById('cd-kl');
    if (tc) tc.value = h.trieu_chung || '';
    if (kqls) kqls.value = h.ket_qua_kham_lam_sang || '';
    if (cd) {
      if (icd) icd.value = cd.ma_icd10 || '';
      if (ten) ten.value = cd.ten_benh || '';
      if (mo) mo.value = cd.mo_ta || '';
      if (kl) kl.value = cd.ket_luan || '';
    }
  },

  async _guiChanDoan() {
    const fixed = document.getElementById('cd-hsid-fixed');
    const sel = document.getElementById('cd-hsid');
    let hoSoId = (fixed?.value || sel?.value || '').trim() || this._hoSoId;
    if (!hoSoId) return Toast.loi('Chưa chọn hồ sơ lần khám', '', 'error');
    this._hoSoId = hoSoId;
    const body = {
      trieu_chung: document.getElementById('cd-tc')?.value ?? '',
      ket_qua_kham_lam_sang: document.getElementById('cd-kqls')?.value ?? '',
      ma_icd10: (document.getElementById('cd-icd')?.value || '').trim(),
      ten_benh: (document.getElementById('cd-ten')?.value || '').trim(),
      mo_ta: (document.getElementById('cd-mo')?.value || '').trim() || '—',
      ket_luan: (document.getElementById('cd-kl')?.value || '').trim() || '—',
    };
    if (!body.ten_benh) return Toast.loi('Nhập tên bệnh', '', 'error');
    const res = await Http.tao(`/benh-an/ho-so-benh-an/${hoSoId}/nhap_chan_doan/`, body);
    const out = document.getElementById('cd-out');
    //if (out) out.textContent = res.ok ? JSON.stringify(res.data, null, 2) : JSON.stringify(res.data || {}, null, 2);
    if (res.ok) {
      Toast.hien('Đã lưu', 'Chẩn đoán đã ghi vào hồ sơ lần khám', 'success');
      this._chanDoanDaLuu = true;
      if (res.data && res.data.ho_so) this._setPatientSnapshotFromHoSo(res.data.ho_so, this._lichHenId);
      this._refreshPatientStrip();
      const nx = document.getElementById('bs-cd-next');
      if (nx) nx.style.display = 'block';
    } else Toast.loi('Lỗi lưu', (res.data && (res.data.detail || res.data.error)) || '', 'error');
  },

  _dtLines: [],
  _dtLastList: [],

  async _formDonThuoc(host) {
    const hs = this._esc(this._hoSoId || '');
    const ps = this._patientSnapshot;
    const bnLine = ps
      ? `${this._esc(ps.tenBn)} — Mã BN ${this._esc(ps.maBn)} — HS ${this._esc(ps.maHs)}`
      : '';
    this._dtLines = [];
    UI.render(host, `
      <div class="card"><div class="card-header"><div class="card-title">Kê đơn thuốc</div></div>
      <div class="card-body">
        ${bnLine ? `<p class="small fw-semibold text-primary mb-2">${bnLine}</p>` : ''}
        <p class="small text-muted">Hồ sơ: <code id="dt-hs-lbl">${hs || '—'}</code></p>
        <input id="dt-hs" type="hidden" value="${hs}"/>
        <label class="small">Chẩn đoán / ghi chú toa</label>
        <input id="dt-chuan" class="form-control form-control-sm mb-2" placeholder="Tóm tắt chẩn đoán (hiển thị trên toa)"/>
        <hr/>
        <p class="small fw-semibold mb-1">Thêm thuốc trong danh mục</p>
        <div class="input-group input-group-sm mb-2" style="max-width:420px">
          <input id="dt-tim-thuoc" class="form-control" placeholder="Tìm tên hoặc mã thuốc…"/>
          <button type="button" class="btn btn-outline-primary" onclick="PageBacSiDashboard._dtTimThuoc()">Tìm</button>
        </div>
        <div id="dt-kq-tim" class="small mb-3"></div>
        <p class="small fw-semibold mb-1">Thuốc mua ngoài (không có trong hệ thống)</p>
        <div class="row g-2 mb-2">
          <div class="col-md-4"><input id="dt-ngoai-ten" class="form-control form-control-sm" placeholder="Tên thuốc"/></div>
          <div class="col-md-2"><input id="dt-ngoai-sl" type="number" min="1" class="form-control form-control-sm" placeholder="SL"/></div>
          <div class="col-md-3"><input id="dt-ngoai-lieu" class="form-control form-control-sm" placeholder="Liều (VD: 1 viên)"/></div>
          <div class="col-md-3"><input id="dt-ngoai-cach" class="form-control form-control-sm" placeholder="Cách uống / ghi chú"/></div>
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary mb-3" onclick="PageBacSiDashboard._dtThemNgoai()">Thêm dòng mua ngoài</button>
        <p class="small fw-semibold">Toa hiện tại (BN sẽ thấy đủ thuốc trong kho + mua ngoài)</p>
        <div id="dt-bang" class="table-responsive mb-3"><p class="text-muted small">Chưa có thuốc.</p></div>
        <button type="button" class="btn btn-primary" onclick="PageBacSiDashboard._guiDonThuoc()">Lưu toa thuốc</button>
      </div></div>`);
  },

  async _dtTimThuoc() {
    const q = document.getElementById('dt-tim-thuoc')?.value?.trim();
    const box = document.getElementById('dt-kq-tim');
    if (!q || !box) return;
    const res = await Http.layDanhSach(`/thuoc/thuoc/?search=${encodeURIComponent(q)}&page_size=15`);
    const rows = res.data?.results || res.data || [];
    const list = Array.isArray(rows) ? rows : [];
    if (!res.ok || !list.length) {
      box.innerHTML = '<span class="text-muted">Không tìm thấy — dùng phần thuốc mua ngoài bên dưới.</span>';
      return;
    }
    this._dtLastList = list;
    box.innerHTML = `<div class="list-group">${list
      .map(
        (t, i) => `<button type="button" class="list-group-item list-group-item-action py-1 text-start" onclick="PageBacSiDashboard._dtChonThuoc(${i})">${this._esc(t.ten_thuoc)} <span class="text-muted">(${this._esc(t.ma_thuoc)})</span></button>`
      )
      .join('')}</div>`;
  },

  _dtChonThuoc(i) {
    const t = this._dtLastList[i];
    if (!t) return;
    const ten = t.ten_thuoc;
    const sl = parseInt(prompt(`Số lượng — ${ten}`, '10'), 10);
    if (!sl || sl < 1) return;
    const lieu = prompt('Liều dùng mỗi lần (VD: 1 viên)', '1 viên') || '1 viên';
    const cach = prompt('Cách uống / tần suất (ghi chú)', 'Sáng, sau ăn') || '';
    this._dtLines.push({
      loai: 'trong_kho',
      thuoc: t.id,
      ten,
      so_luong: sl,
      lieu_dung: lieu,
      cach_dung: 'UONG',
      thoi_diem: 'SANG',
      so_ngay_dung: 5,
      tan_suat: cach,
    });
    this._dtVeBang();
  },

  _dtThemNgoai() {
    const ten = document.getElementById('dt-ngoai-ten')?.value?.trim();
    const sl = parseInt(document.getElementById('dt-ngoai-sl')?.value || '0', 10);
    const lieu = document.getElementById('dt-ngoai-lieu')?.value?.trim() || '—';
    const cach = document.getElementById('dt-ngoai-cach')?.value?.trim() || '';
    if (!ten || sl < 1) return Toast.loi('Nhập tên thuốc và số lượng', '', 'error');
    this._dtLines.push({
      loai: 'ngoai',
      la_thuoc_mua_ngoai: true,
      ten_thuoc_tu_do: ten,
      so_luong: sl,
      lieu_dung: lieu,
      cach_dung: 'UONG',
      thoi_diem: 'SANG',
      so_ngay_dung: 5,
      tan_suat: cach,
    });
    document.getElementById('dt-ngoai-ten').value = '';
    document.getElementById('dt-ngoai-sl').value = '';
    document.getElementById('dt-ngoai-lieu').value = '';
    document.getElementById('dt-ngoai-cach').value = '';
    this._dtVeBang();
  },

  _dtXoa(i) {
    this._dtLines.splice(i, 1);
    this._dtVeBang();
  },

  _dtVeBang() {
    const el = document.getElementById('dt-bang');
    if (!el) return;
    if (!this._dtLines.length) {
      el.innerHTML = '<p class="text-muted small">Chưa có thuốc.</p>';
      return;
    }
    el.innerHTML = `<table class="table table-sm table-bordered mb-0"><thead><tr><th>Loại</th><th>Tên</th><th>SL</th><th>Liều</th><th>Cách dùng</th><th></th></tr></thead><tbody>
      ${this._dtLines
        .map((r, i) => {
          const loai = r.loai === 'ngoai' ? '<span class="badge bg-warning text-dark">Mua ngoài</span>' : '<span class="badge bg-success">Trong kho</span>';
          const ten = r.loai === 'ngoai' ? r.ten_thuoc_tu_do : r.ten;
          return `<tr><td>${loai}</td><td>${this._esc(ten)}</td><td>${r.so_luong}</td><td>${this._esc(r.lieu_dung)}</td><td class="small">${this._esc(r.tan_suat || '')}</td><td><button type="button" class="btn btn-sm btn-link text-danger p-0" onclick="PageBacSiDashboard._dtXoa(${i})">Xóa</button></td></tr>`;
        })
        .join('')}
    </tbody></table>`;
  },

  async _guiDonThuoc() {
    let id = document.getElementById('dt-hs')?.value?.trim() || this._hoSoId;
    if (!id) return Toast.loi('Chưa có hồ sơ — mở từ lịch hoặc Hồ sơ BN', '', 'error');
    if (!this._dtLines.length) return Toast.loi('Chưa có thuốc trên toa', '', 'error');
    const chuan_doan = document.getElementById('dt-chuan')?.value?.trim() || '';
    const chi_tiet = this._dtLines.map((r) => {
      if (r.loai === 'ngoai') {
        return {
          la_thuoc_mua_ngoai: true,
          ten_thuoc_tu_do: r.ten_thuoc_tu_do,
          so_luong: r.so_luong,
          lieu_dung: r.lieu_dung,
          cach_dung: r.cach_dung,
          thoi_diem: r.thoi_diem,
          so_ngay_dung: r.so_ngay_dung,
          tan_suat: r.tan_suat,
        };
      }
      return {
        thuoc: r.thuoc,
        so_luong: r.so_luong,
        lieu_dung: r.lieu_dung,
        cach_dung: r.cach_dung,
        thoi_diem: r.thoi_diem,
        so_ngay_dung: r.so_ngay_dung,
        tan_suat: r.tan_suat,
      };
    });
    const res = await Http.tao(`/benh-an/ho-so-benh-an/${id}/tao_don_thuoc/`, { chuan_doan, chi_tiet });
    if (res.ok) Toast.hien('Đã tạo toa', res.data?.ma_don ? `Mã: ${res.data.ma_don}` : '', 'success');
    else Toast.loi('Không tạo được toa', (res.data && (res.data.detail || JSON.stringify(res.data))) || '', 'error');
  },

  async _taiDanhSachVaccineTiem() {
    const sel = document.getElementById('ti-vc');
    if (!sel) return;
    sel.innerHTML = '<option value="">Đang tải vaccine...</option>';
    const res = await Http.layDanhSach('/thuoc/vaccine/?trang_thai=true&ordering=ten_vaccine&page_size=500');
    const rows = (res.data && res.data.results) || res.data || [];
    const list = Array.isArray(rows) ? rows : [];
    if (!res.ok || !list.length) {
      sel.innerHTML = '<option value="">Không có vaccine khả dụng</option>';
      return;
    }
    sel.innerHTML =
      '<option value="">-- Chọn vaccine --</option>' +
      list
        .map((v) => {
          const label = `${v.ma_vaccine || ''} - ${v.ten_vaccine || ''}${v.ton_kho != null ? ` (Tồn: ${v.ton_kho})` : ''}`;
          return `<option value="${this._esc(v.id)}">${this._esc(label)}</option>`;
        })
        .join('');
  },

  async _chiDinh(host) {
    const hs = this._esc(this._hoSoId || '');
    const ps = this._patientSnapshot;
    const bnLine = ps
      ? `<p class="small fw-semibold text-primary mb-2">${this._esc(ps.tenBn)} — Mã BN ${this._esc(ps.maBn)} — HS ${this._esc(ps.maHs)}</p>`
      : '';
    UI.render(host, `
      <div class="card"><div class="card-header">Tiêm chủng</div><div class="card-body">
        ${bnLine}
        <p class="small text-muted">Hồ sơ: <code>${hs || '—'}</code></p>
        <input id="ti-hs" class="form-control mb-2" type="hidden" value="${hs}"/>
        <label class="small">Vaccine</label>
        <select id="ti-vc" class="form-control mb-2"></select>
        <input id="ti-ngay" class="form-control mb-2" type="date"/>
        <button type="button" class="btn btn-primary" onclick="PageBacSiDashboard._guiTiem()">Lưu</button>
        <pre id="ti-out" class="mt-2 small"></pre>
      </div></div>`);
    await this._taiDanhSachVaccineTiem();
  },

  async _guiTiem() {
    let id = document.getElementById('ti-hs')?.value?.trim() || this._hoSoId;
    if (!id) return Toast.loi('Chưa có hồ sơ', '', 'error');
    const vaccineId = (document.getElementById('ti-vc')?.value || '').trim();
    if (!vaccineId) return Toast.loi('Chọn vaccine trước khi lưu', '', 'error');
    const body = {
      vaccine: vaccineId,
      ngay_tiem: document.getElementById('ti-ngay').value,
      trang_thai: 'HEN_TIEM',
    };
    const res = await Http.tao(`/benh-an/ho-so-benh-an/${id}/chi_dinh_tiem/`, body);
    document.getElementById('ti-out').textContent = JSON.stringify(res.data, null, 2);
    if (res.ok) Toast.hien('Đã lưu', '', 'success');
  },

};

window.PageBacSiDashboard = PageBacSiDashboard;
