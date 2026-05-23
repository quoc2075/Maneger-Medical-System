/**
 * Lễ tân — chỉ dùng tại quầy (offline): đăng ký BN, tiếp nhận (có hẹn / chưa hẹn lấy số / hàng chờ phòng), xem lịch trong ngày.
 */
const PageLeTanDashboard = {
  _esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  },

  /** Nhận diện UUID (khóa bệnh nhân) — còn lại coi là mã bệnh nhân */
  _laUuid(s) {
    const t = String(s || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
  },

  /** Ngày theo giờ máy (quầy VN) — không dùng toISOString() (UTC) để khớp lọc ngày trên server */
  _ngayLocalISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  _setNavActive(trang) {
    const map = {
      'tong-quan': 'tq',
      'dang-ky': 'dk',
      'tiep-nhan': 'tn',
      'danh-sach': 'ds',
      'dat-lich': 'tn',
      'check-in': 'tn',
      'dieu-phoi': 'tn',
    };
    const cur = map[trang] || 'tq';
    document.querySelectorAll('[data-lt-nav]').forEach((b) => {
      const on = b.getAttribute('data-lt-nav') === cur;
      b.classList.toggle('active', on);
    });
  },

  async render() {
    const { hoTen } = Auth.layThongTin();
    const navHtml = `
      <button type="button" class="nav-item" data-lt-nav="tq" onclick="PageLeTanDashboard.chuyenTrang('tong-quan')"><i class="fas fa-chart-pie"></i><span>Trang chủ</span></button>
      <button type="button" class="nav-item" data-lt-nav="dk" onclick="PageLeTanDashboard.chuyenTrang('dang-ky')"><i class="fas fa-user-plus"></i><span>Đăng ký bệnh nhân</span></button>
      <button type="button" class="nav-item" data-lt-nav="tn" onclick="PageLeTanDashboard.chuyenTrang('tiep-nhan')"><i class="fas fa-ticket-alt"></i><span>Tiếp nhận &amp; lấy số</span></button>
      <button type="button" class="nav-item" data-lt-nav="ds" onclick="PageLeTanDashboard.chuyenTrang('danh-sach')"><i class="fas fa-calendar-day"></i><span>Lịch trong ngày</span></button>`;
    window.RoleDashboardShell.mount('app-root', {
      brandTitle: 'PhòngKhám+',
      brandAccent: 'Lễ tân',
      brandIcon: 'fa-calendar-check',
      navHtml,
      mainHostId: 'le-tan-main',
      userName: hoTen || 'Nhân viên',
      userRoleLabel: 'Lễ tân — Tiếp nhận',
      contentMaxWidth: '1280px',
    });
    await this.chuyenTrang('tiep-nhan');
  },

  async chuyenTrang(trang) {
    this._setNavActive(trang);
    const host = 'le-tan-main';
    if (trang === 'tong-quan') return this._tongQuan(host);
    if (trang === 'dang-ky') return this._dangKy(host);
    if (trang === 'tiep-nhan') return this._tiepNhan(host);
    if (trang === 'danh-sach') return this._danhSachLich(host);
    /* Tên cũ / liên kết ngoài → cùng màn tiếp nhận tại quầy */
    if (['dat-lich', 'check-in', 'dieu-phoi'].includes(trang)) return this._tiepNhan(host);
    return this._tongQuan(host);
  },

  async _tongQuan(host) {
    const today = this._ngayLocalISO();
    const res = await Http.layDanhSach(
      `/lich-hen/lich-hen/?hom_nay=true&page_size=100`
    );
    const list = res.data?.results || [];
    const choDen = list.filter((l) =>
      ['CHO_XAC_NHAN', 'DA_DAT', 'DA_XAC_NHAN', 'QUA_HAN'].includes(l.trang_thai)
    ).length;
    UI.render(host, `
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><div class="card-title">Hôm nay (${today})</div></div>
          <div class="card-body">
            <p><strong>${list.length}</strong> lịch ghi nhận trong hệ thống.</p>
            <p class="text-muted small">Ước lượng còn chờ tiếp nhận / check-in: <strong>${choDen}</strong>.</p>
            <button class="btn btn-primary btn-sm mt-2" onclick="PageLeTanDashboard.chuyenTrang('tiep-nhan')">Mở tiếp nhận</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Thao tác tại quầy</div></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-outline" onclick="PageLeTanDashboard.chuyenTrang('dang-ky')">Đăng ký bệnh nhân mới</button>
            <button class="btn btn-outline" onclick="PageLeTanDashboard.chuyenTrang('tiep-nhan')">Check-in / lấy số theo bác sĩ</button>
            <button class="btn btn-outline" onclick="PageLeTanDashboard.chuyenTrang('danh-sach')">Xem lịch trong ngày</button>
          </div>
        </div>
      </div>`);
  },

  async _dangKy(host) {
    UI.render(host, `
      <div class="card">
        <div class="card-header"><div class="card-title">Đăng ký tài khoản bệnh nhân (tại quầy)</div></div>
        <div class="card-body">
          <p class="text-muted small mb-3">Tài khoản luôn là vai trò <strong>Bệnh nhân</strong>. Mật khẩu: tối thiểu 8 ký tự, có chữ hoa, số và ký tự đặc biệt (theo quy định hệ thống).</p>
          <div class="grid-2">
            <div><label class="form-label">Tên đăng nhập *</label>
              <input id="lt-dk-user" class="form-control" autocomplete="off"/></div>
            <div><label class="form-label">Mật khẩu *</label>
              <input id="lt-dk-pw1" type="password" class="form-control"/></div>
            <div><label class="form-label">Nhập lại mật khẩu *</label>
              <input id="lt-dk-pw2" type="password" class="form-control"/></div>
            <div><label class="form-label">Họ tên *</label>
              <input id="lt-dk-hoten" class="form-control"/></div>
            <div><label class="form-label">Email *</label>
              <input id="lt-dk-email" type="email" class="form-control"/></div>
            <div><label class="form-label">Số điện thoại *</label>
              <input id="lt-dk-sdt" class="form-control" placeholder="0xxxxxxxxx"/></div>
            <div><label class="form-label">Ngày sinh *</label>
              <input id="lt-dk-ns" type="date" class="form-control"/></div>
            <div><label class="form-label">Giới tính *</label>
              <select id="lt-dk-gt" class="form-control">
                <option value="NAM">Nam</option><option value="NU">Nữ</option><option value="KHAC">Khác</option>
              </select></div>
            <div style="grid-column:1/-1"><label class="form-label">Địa chỉ *</label>
              <input id="lt-dk-dc" class="form-control"/></div>
          </div>
          <button type="button" class="btn btn-primary mt-3" onclick="PageLeTanDashboard._submitDangKy()">Tạo tài khoản</button>
        </div>
      </div>`);
  },

  async _submitDangKy() {
    const pw1 = document.getElementById('lt-dk-pw1')?.value || '';
    const pw2 = document.getElementById('lt-dk-pw2')?.value || '';
    if (pw1 !== pw2) {
      Toast.loi('Mật khẩu không khớp', '', 'error');
      return;
    }
    const body = {
      nguoi_dung: {
        ten_dang_nhap: document.getElementById('lt-dk-user')?.value?.trim(),
        password: pw1,
        password2: pw2,
        ho_ten: document.getElementById('lt-dk-hoten')?.value?.trim(),
        email: document.getElementById('lt-dk-email')?.value?.trim(),
        so_dien_thoai: document.getElementById('lt-dk-sdt')?.value?.trim(),
        ngay_sinh: document.getElementById('lt-dk-ns')?.value,
        gioi_tinh: document.getElementById('lt-dk-gt')?.value,
        dia_chi: document.getElementById('lt-dk-dc')?.value?.trim(),
      },
      ngay_sinh: document.getElementById('lt-dk-ns')?.value,
      gioi_tinh: document.getElementById('lt-dk-gt')?.value,
      dia_chi: document.getElementById('lt-dk-dc')?.value?.trim(),
    };
    const res = await Http.tao('/admin/benh-nhan/', body);
    if (res.ok) Toast.hien('Thành công', `Mã BN: ${res.data?.ma_benh_nhan || ''}`, 'success');
    else Toast.loi('Lỗi', (res.data && JSON.stringify(res.data)) || '', 'error');
  },

  async _taiBacSiXepHang(ngay) {
    const base = '/lich-hen/lich-hen/bac_si_xep_hang/';
    return Http.layDanhSach(ngay ? `${base}?ngay=${encodeURIComponent(ngay)}` : base);
  },

  /** Màn hình chính: có hẹn | chưa hẹn lấy số | hàng chờ phòng */
  async _tiepNhan(host) {
    // Không gửi ngay: server dùng TIME_ZONE (VN), khớp walk-in.
    const rankRes = await this._taiBacSiXepHang();
    const bsItems = rankRes.data?.items || [];
    UI.render(host, `
      <div class="card mb-2">
        <div class="card-header"><div class="card-title">Tiếp nhận tại quầy</div></div>
        <div class="card-body" style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn btn-primary btn-sm" id="lt-ci-tab-a" onclick="PageLeTanDashboard._tiepNhanTab('co-lich')">① Có hẹn trước — check-in</button>
          <button type="button" class="btn btn-outline btn-sm" id="lt-ci-tab-b" onclick="PageLeTanDashboard._tiepNhanTab('lay-so')">② Chưa hẹn — chọn BS &amp; lấy số</button>
          <button type="button" class="btn btn-outline btn-sm" id="lt-ci-tab-c" onclick="PageLeTanDashboard._tiepNhanTab('hang-cho')">③ Hàng chờ &amp; phòng</button>
        </div>
      </div>
      <div id="lt-ci-panel"></div>`);
    window.__ltBsXepHang = bsItems;
    await this._tiepNhanTab('co-lich');
  },

  async _tiepNhanTab(which) {
    const a = document.getElementById('lt-ci-tab-a');
    const b = document.getElementById('lt-ci-tab-b');
    const c = document.getElementById('lt-ci-tab-c');
    const prim = 'btn btn-primary btn-sm';
    const outl = 'btn btn-outline btn-sm';
    if (a && b && c) {
      [a, b, c].forEach((el) => { el.className = outl; });
      if (which === 'co-lich') a.className = prim;
      else if (which === 'lay-so') b.className = prim;
      else c.className = prim;
    }
    if (which === 'lay-so') return this._panelLaySo('lt-ci-panel');
    if (which === 'hang-cho') return this._panelHangCho('lt-ci-panel');
    return this._panelCoHen('lt-ci-panel');
  },

  async _panelCoHen(panelId) {
    const res = await Http.layDanhSach(
      `/lich-hen/lich-hen/hom_nay_letan/?chua_check_in=true&page_size=200`
    );
    const list = res.data?.results || res.data || [];
    const arr = Array.isArray(list) ? list : [];
    const rankRes = await this._taiBacSiXepHang();
    const bsItems = rankRes.data?.items || [];
    const host = document.getElementById(panelId);
    if (!host) return;
    host.innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">Bệnh nhân đã có lịch hôm nay (chưa check-in)</div></div>
        <div class="card-body" style="overflow:auto">
          <p class="text-muted small">Nhấn <strong>Check-in</strong> khi BN đến đúng hẹn. Có thể đổi bác sĩ trước khi vào nếu cần.</p>
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Giờ hẹn</th><th>Mã lịch</th><th>BN</th><th>BS</th><th>TT</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${arr
                .map((l) => {
                  const selId = `lt-pc-bs-${l.id}`;
                  return `<tr>
                  <td>${this._esc(String(l.ngay_gio_hen || '').replace('T', ' ').slice(0, 16))}</td>
                  <td>${this._esc(l.ma_lich_hen || '')}</td>
                  <td>${this._esc(l.ten_benh_nhan || '')}<div class="text-muted small">${this._esc(l.ma_benh_nhan || '')}</div></td>
                  <td>${this._esc(l.ten_bac_si || '—')}</td>
                  <td>${this._esc(l.trang_thai_display || l.trang_thai)}</td>
                  <td style="white-space:nowrap">
                    <button type="button" class="btn btn-sm btn-primary" onclick="PageLeTanDashboard._doCheckIn('${l.id}')">Check-in</button>
                    <select id="${selId}" class="form-control form-control-sm d-inline-block" style="max-width:160px;vertical-align:middle">
                      <option value="">Chọn BS</option>
                      ${bsItems
                        .map(
                          (x) =>
                            `<option value="${this._esc(x.id)}">${this._esc(x.ho_ten)} (${x.so_benh_nhan_trong_ngay})</option>`
                        )
                        .join('')}
                    </select>
                    <button type="button" class="btn btn-sm btn-outline" onclick="PageLeTanDashboard._doPhanCong('${l.id}','${selId}')">Gán BS</button>
                  </td>
                </tr>`;
                })
                .join('')}
            </tbody>
          </table>
          ${!arr.length ? '<p class="text-muted">Không có lịch chờ check-in hôm nay.</p>' : ''}
        </div>
      </div>`;
  },

  async _panelLaySo(panelId) {
    const rankRes = await this._taiBacSiXepHang();
    const bsItems = rankRes.data?.items || [];
    window.__ltBsXepHang = bsItems;
    const host = document.getElementById(panelId);
    if (!host) return;
    host.innerHTML = `
      <div class="card mb-2">
        <div class="card-header"><div class="card-title">Thứ tự bác sĩ (ít bệnh nhân trong ngày → nhiều)</div></div>
        <div class="card-body" style="overflow:auto">
          <p class="text-muted small">Dùng để chọn bác sĩ còn nhẹ tải. STT lấy theo thứ tự tiếp nhận trong ngày.</p>
          <table class="table table-sm">
            <thead><tr><th>TT</th><th>Bác sĩ</th><th>Khoa</th><th>BN trong ngày</th></tr></thead>
            <tbody>
              ${bsItems
                .map(
                  (x, i) => `<tr>
                <td>${i + 1}</td>
                <td>${this._esc(x.ho_ten)} <span class="text-muted small">(${this._esc(x.ma_bac_si)})</span></td>
                <td>${this._esc(x.chuyen_khoa || '')}</td>
                <td><strong>${x.so_benh_nhan_trong_ngay}</strong></td>
              </tr>`
                )
                .join('')}
            </tbody>
          </table>
          ${!bsItems.length ? '<p class="text-muted">Không có bác sĩ làm việc.</p>' : ''}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Lấy số — BN chưa đặt trước</div></div>
        <div class="card-body">
          <p class="text-muted small">Nhập <strong>mã bệnh nhân</strong> (đã đăng ký tại quầy), chọn <strong>Khám bệnh</strong> hoặc <strong>Tiêm chủng</strong> (tiêm cần chọn vaccine). Bật <em>tự chọn bác sĩ</em> để hệ thống gán theo bảng trên; hoặc chọn tay một bác sĩ. Sau khi tạo, BN có STT và trạng thái đã check-in.</p>
          <div class="grid-2">
            <div style="grid-column:1/-1">
              <label class="form-label">Mã bệnh nhân *</label>
              <input id="lt-wi-bn" class="form-control" placeholder="VD: BN20260411001"/>
            </div>
            <div style="grid-column:1/-1">
              <label class="form-label">Loại tiếp nhận *</label>
              <div class="d-flex flex-wrap gap-3 mb-1">
                <label class="form-label mb-0" style="font-weight:normal;cursor:pointer">
                  <input type="radio" name="lt-wi-loai" id="lt-wi-loai-kham" value="KHAM_BENH" checked onchange="PageLeTanDashboard._toggleLoaiWalkIn()"/>
                  Khám bệnh
                </label>
                <label class="form-label mb-0" style="font-weight:normal;cursor:pointer">
                  <input type="radio" name="lt-wi-loai" id="lt-wi-loai-tiem" value="TIEM_CHUNG" onchange="PageLeTanDashboard._toggleLoaiWalkIn()"/>
                  Tiêm chủng
                </label>
              </div>
            </div>
            <div id="lt-wi-vaccine-wrap" style="grid-column:1/-1;display:none">
              <label class="form-label">Vaccine sẽ tiêm *</label>
              <select id="lt-wi-vaccine" class="form-control">
                <option value="">Đang tải vaccine...</option>
              </select>
            </div>
            <div style="grid-column:1/-1">
              <label class="form-label d-block">
                <input type="checkbox" id="lt-wi-auto" checked/> Tự chọn bác sĩ (ưu tiên BS ít BN trong ngày)
              </label>
            </div>
            <div style="grid-column:1/-1">
              <label class="form-label">Hoặc chọn bác sĩ cụ thể (khi tắt tự chọn)</label>
              <select id="lt-wi-bs" class="form-control">
                <option value="">—</option>
                ${bsItems.map((x) => `<option value="${this._esc(x.id)}">${this._esc(x.ho_ten)} (${x.so_benh_nhan_trong_ngay} BN)</option>`).join('')}
              </select>
            </div>
            <div><label class="form-label">Mã phòng (tuỳ chọn)</label>
              <input id="lt-wi-mp" class="form-control" placeholder="VD: P01"/></div>
            <div><label class="form-label">Tên phòng</label>
              <input id="lt-wi-tp" class="form-control"/></div>
            <div style="grid-column:1/-1"><label class="form-label">Ghi chú</label>
              <input id="lt-wi-gc" class="form-control"/></div>
          </div>
          <button type="button" class="btn btn-primary mt-2" onclick="PageLeTanDashboard._submitLaySo()">Xác nhận &amp; lấy số</button>
        </div>
      </div>`;
    await this._taiVaccineWalkIn();
    this._toggleLoaiWalkIn();
  },

  _layLoaiWalkIn() {
    return document.getElementById('lt-wi-loai-tiem')?.checked ? 'TIEM_CHUNG' : 'KHAM_BENH';
  },

  _toggleLoaiWalkIn() {
    const wrap = document.getElementById('lt-wi-vaccine-wrap');
    if (!wrap) return;
    const isTiem = this._layLoaiWalkIn() === 'TIEM_CHUNG';
    wrap.style.display = isTiem ? '' : 'none';
  },

  async _taiVaccineWalkIn() {
    const sel = document.getElementById('lt-wi-vaccine');
    if (!sel) return;
    const res = await Http.layDanhSach('/thuoc/vaccine/?trang_thai=true&ordering=ten_vaccine&page_size=200');
    const rows = res.data?.results || res.data || [];
    const list = Array.isArray(rows) ? rows : [];
    if (!res.ok || !list.length) {
      sel.innerHTML = '<option value="">Không có vaccine khả dụng</option>';
      return;
    }
    sel.innerHTML =
      '<option value="">-- Chọn vaccine --</option>' +
      list
        .map((v) => {
          const label = `${v.ma_vaccine || ''} — ${v.ten_vaccine || ''}`;
          return `<option value="${this._esc(v.id)}">${this._esc(label)}</option>`;
        })
        .join('');
  },

  async _submitLaySo() {
    const maOrUuid = document.getElementById('lt-wi-bn')?.value?.trim();
    if (!maOrUuid) return Toast.loi('Nhập mã bệnh nhân', '', 'error');
    const loaiLich = this._layLoaiWalkIn();
    if (loaiLich === 'TIEM_CHUNG') {
      const vc = document.getElementById('lt-wi-vaccine')?.value?.trim();
      if (!vc) return Toast.loi('Chọn vaccine', 'Tiêm chủng bắt buộc chọn loại vaccine.', 'error');
    }
    const auto = document.getElementById('lt-wi-auto')?.checked;
    const bs = document.getElementById('lt-wi-bs')?.value?.trim();
    const body = {
      tu_dong_chon_bac_si: !!auto,
      loai_lich: loaiLich,
      ma_phong: document.getElementById('lt-wi-mp')?.value?.trim() || '',
      ten_phong: document.getElementById('lt-wi-tp')?.value?.trim() || '',
      ghi_chu: document.getElementById('lt-wi-gc')?.value?.trim() || '',
    };
    if (loaiLich === 'TIEM_CHUNG') {
      body.vaccine = document.getElementById('lt-wi-vaccine')?.value?.trim();
    }
    if (this._laUuid(maOrUuid)) body.benh_nhan = maOrUuid;
    else body.ma_benh_nhan = maOrUuid;
    if (!auto && bs) body.bac_si = bs;
    const res = await Http.tao('/lich-hen/lich-hen/walk_in/', body);
    if (res.ok) {
      const d = res.data || {};
      const loaiLabel = loaiLich === 'TIEM_CHUNG' ? 'Tiêm chủng' : 'Khám bệnh';
      Toast.hien('Đã lấy số', `${loaiLabel} — STT ${d.stt_trong_ngay ?? '—'} — ${d.ma_lich_hen || ''}`, 'success');
      await this._tiepNhanTab('hang-cho');
    } else {
      const msg =
        res.data != null ? JSON.stringify(res.data) : res.statusText || 'Không có phản hồi từ máy chủ';
      Toast.loi('Không lấy số được', msg, 'error');
    }
  },

  async _panelHangCho(panelId) {
    const res = await Http.layDanhSach(
      `/lich-hen/lich-hen/dieu_phoi_hom_nay/?page_size=200`
    );
    const raw = res.data?.results || res.data || [];
    const list = Array.isArray(raw) ? raw : [];
    const rankRes = await this._taiBacSiXepHang();
    const bsItems = rankRes.data?.items || [];
    const host = document.getElementById(panelId);
    if (!host) return;
    host.innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">BN đã check-in — gán phòng / đổi bác sĩ</div></div>
        <div class="card-body" style="overflow:auto">
          <p class="text-muted small">Danh sách theo STT trong ngày.</p>
          <table class="table table-sm">
            <thead>
              <tr>
                <th>STT</th><th>Giờ</th><th>Mã lịch</th><th>Loại</th><th>BN</th><th>BS</th><th>Phòng</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${list
                .map((l) => {
                  const selId = `lt-dp-bs-${l.id}`;
                  const mid = `lt-dp-mp-${l.id}`;
                  const tid = `lt-dp-tp-${l.id}`;
                  return `<tr>
                  <td><strong>${l.stt_trong_ngay != null ? this._esc(String(l.stt_trong_ngay)) : '—'}</strong></td>
                  <td>${this._esc(String(l.ngay_gio_hen || '').replace('T', ' ').slice(0, 16))}</td>
                  <td>${this._esc(l.ma_lich_hen || '')}</td>
                  <td>${this._esc(l.loai_lich_display || l.loai_lich || '—')}</td>
                  <td>${this._esc(l.ten_benh_nhan || '')}<div class="text-muted small">${this._esc(l.ma_benh_nhan || '')}</div></td>
                  <td>${this._esc(l.ten_bac_si || '—')}</td>
                  <td>
                    <input id="${mid}" class="form-control form-control-sm mb-1" placeholder="Mã phòng" value="${this._esc(l.ma_phong || '')}"/>
                    <input id="${tid}" class="form-control form-control-sm" placeholder="Tên phòng" value="${this._esc(l.ten_phong || '')}"/>
                  </td>
                  <td style="white-space:nowrap;min-width:220px">
                    <select id="${selId}" class="form-control form-control-sm mb-1">
                      <option value="">Đổi BS</option>
                      ${bsItems
                        .map(
                          (x) =>
                            `<option value="${this._esc(x.id)}">${this._esc(x.ho_ten)}</option>`
                        )
                        .join('')}
                    </select>
                    <button type="button" class="btn btn-sm btn-outline mb-1" onclick="PageLeTanDashboard._doPhanCongDp('${this._esc(l.id)}','${selId}')">Gán BS</button>
                    <button type="button" class="btn btn-sm btn-primary" onclick="PageLeTanDashboard._savePhong('${this._esc(l.id)}','${mid}','${tid}')">Lưu phòng</button>
                  </td>
                </tr>`;
                })
                .join('')}
            </tbody>
          </table>
          ${!list.length ? '<p class="text-muted">Chưa có BN đã check-in.</p>' : ''}
        </div>
      </div>`;
  },

  async _doCheckIn(lichId) {
    const res = await Http.tao(`/lich-hen/lich-hen/${lichId}/check_in/`, {});
    if (res.ok) Toast.hien('Check-in', 'Đã tiếp nhận', 'success');
    else Toast.loi('Lỗi', JSON.stringify(res.data), 'error');
    await this.chuyenTrang('tiep-nhan');
  },

  async _doPhanCong(lichId, selectId) {
    const sel = document.getElementById(selectId);
    const bacSi = sel?.value?.trim();
    if (!bacSi) return Toast.canh('Chọn bác sĩ', '');
    const res = await Http.tao(`/lich-hen/lich-hen/${lichId}/phan_cong_bac_si/`, { bac_si: bacSi });
    if (res.ok) Toast.hien('Đã phân công', '', 'success');
    else Toast.loi('Lỗi', JSON.stringify(res.data), 'error');
    await this.chuyenTrang('tiep-nhan');
  },

  async _doPhanCongDp(lichId, selectId) {
    const sel = document.getElementById(selectId);
    const bacSi = sel?.value?.trim();
    if (!bacSi) return Toast.canh('Chọn bác sĩ', '');
    const res = await Http.tao(`/lich-hen/lich-hen/${lichId}/phan_cong_bac_si/`, { bac_si: bacSi });
    if (res.ok) Toast.hien('Đã phân công BS', '', 'success');
    else Toast.loi('Lỗi', JSON.stringify(res.data), 'error');
    await this._tiepNhanTab('hang-cho');
  },

  async _savePhong(lichId, mid, tid) {
    const ma = document.getElementById(mid)?.value?.trim();
    const ten = document.getElementById(tid)?.value?.trim() || '';
    if (!ma) return Toast.loi('Nhập mã phòng', '', 'error');
    const res = await Http.tao(`/lich-hen/lich-hen/${lichId}/phan_cong_phong/`, {
      ma_phong: ma,
      ten_phong: ten,
    });
    if (res.ok) Toast.hien('Đã cập nhật phòng', '', 'success');
    else Toast.loi('Lỗi', JSON.stringify(res.data), 'error');
    await this._tiepNhanTab('hang-cho');
  },

  async _danhSachLich(host) {
    const today = this._ngayLocalISO();
    UI.render(host, `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Lịch trong ngày (xem nhanh)</div>
        </div>
        <div class="card-body">
          <p class="text-muted small mb-2">Mặc định hôm nay — có thể đổi khoảng ngày nếu cần tra cứu.</p>
          <div class="grid-2 mb-2">
            <div><label>Từ ngày</label><input id="lt-ls-tu" type="date" class="form-control" value="${today}"/></div>
            <div><label>Đến ngày</label><input id="lt-ls-den" type="date" class="form-control" value="${today}"/></div>
          </div>
          <button type="button" class="btn btn-primary btn-sm mb-2" onclick="PageLeTanDashboard._taiDanhSachLich()">Tải danh sách</button>
          <div id="lt-ls-body"></div>
        </div>
      </div>`);
    await this._taiDanhSachLich();
  },

  async _taiDanhSachLich() {
    const tu = document.getElementById('lt-ls-tu')?.value || this._ngayLocalISO();
    const den = document.getElementById('lt-ls-den')?.value || tu;
    const res = await Http.layDanhSach(
      `/lich-hen/lich-hen/?tu_ngay=${encodeURIComponent(tu)}&den_ngay=${encodeURIComponent(den)}&ordering=-ngay_gio_hen&page_size=200`
    );
    const list = res.data?.results || [];
    const box = document.getElementById('lt-ls-body');
    if (!box) return;
    if (!res.ok) {
      box.innerHTML = '<p class="text-danger">Không tải được.</p>';
      return;
    }
    box.innerHTML =
      `<table class="table table-sm">
        <thead><tr><th>Thời gian</th><th>Mã lịch</th><th>BN</th><th>Mã BN</th><th>Bác sĩ</th><th>Trạng thái</th></tr></thead>
        <tbody>` +
      list
        .map(
          (l) => `<tr>
      <td>${this._esc(String(l.ngay_gio_hen || '').replace('T', ' ').slice(0, 16))}</td>
      <td>${this._esc(l.ma_lich_hen || '')}</td>
      <td>${this._esc(l.ten_benh_nhan || '')}</td>
      <td>${this._esc(l.ma_benh_nhan || '')}</td>
      <td>${this._esc(l.ten_bac_si || '—')}</td>
      <td>${this._esc(l.trang_thai_display || l.trang_thai)}</td>
    </tr>`
        )
        .join('') +
      `</tbody></table>` +
      (!list.length ? '<p class="text-muted">Không có dữ liệu.</p>' : '');
  },
};

window.PageLeTanDashboard = PageLeTanDashboard;
