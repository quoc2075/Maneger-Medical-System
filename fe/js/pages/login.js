/**
 * Trang Đăng nhập / Đăng ký
 */
const PageDangNhap = {
  _rendered: false,
  render() {
    if (this._rendered) return;
    this._rendered = true;

    document.getElementById('app-root').innerHTML = `
      <div id="toast-container"></div>
      <div class="auth-page">
        <div class="auth-left">
          <div class="auth-brand">
            <div class="auth-brand-icon">🏥</div>
            <div>
              <h1 class="t-display">Phòng<span style="color:var(--c-mint)">Khám</span>+</h1>
              <p style="color:rgba(255,255,255,.5);font-size:13px;letter-spacing:1px">HỆ THỐNG QUẢN LÝ PHÒNG KHÁM</p>
            </div>
          </div>

          <ul class="auth-features">
            <li><span class="auth-feature-icon" style="background:rgba(0,201,167,.2)">📅</span>
                Đặt lịch khám và tiêm chủng trực tuyến</li>
            <li><span class="auth-feature-icon" style="background:rgba(59,130,246,.2)">💊</span>
                Mua thuốc online, giao tận nhà</li>
            <li><span class="auth-feature-icon" style="background:rgba(239,68,68,.2)">📱</span>
                Nhận SMS nhắc lịch tự động</li>
            <li><span class="auth-feature-icon" style="background:rgba(139,92,246,.2)">🔐</span>
                Bảo mật JWT, mã hóa dữ liệu</li>
          </ul>

          <div class="auth-footnote">
            Hệ thống quản lý phòng khám<br>
            REST API + WebSocket (TCP/IP)
          </div>
        </div>

        <div class="auth-right">
          <div class="auth-box">
            <!-- TABS -->
            <div class="auth-tabs">
              <button class="auth-tab active" id="tab-dang-nhap" onclick="PageDangNhap.doiTab('dang-nhap')">
                <i class="fas fa-sign-in-alt"></i> Đăng nhập
              </button>
              <button class="auth-tab" id="tab-dang-ky" onclick="PageDangNhap.doiTab('dang-ky')">
                <i class="fas fa-user-plus"></i> Đăng ký
              </button>
            </div>

            <!-- ─── FORM ĐĂNG NHẬP ─── -->
            <div id="form-dang-nhap">
              <h2 style="color:var(--c-navy);margin-bottom:6px">Chào mừng trở lại!</h2>
              <p class="text-muted mb-3">Đăng nhập để tiếp tục</p>

              <div class="form-alert error" id="loi-dang-nhap"></div>

              <div class="form-group">
                <label class="form-label">Tên tài khoản / Email</label>
                <div class="form-control-icon">
                  <i class="fas fa-user input-icon"></i>
                  <input id="dn-tai-khoan" type="text" class="form-control"
                         placeholder="ten_tai_khoan hoặc email"
                         onkeydown="if(event.key==='Enter')PageDangNhap.dangNhap()">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Mật khẩu</label>
                <div class="form-control-icon">
                  <i class="fas fa-lock input-icon"></i>
                  <input id="dn-mat-khau" type="password" class="form-control"
                         placeholder="Nhập mật khẩu"
                         onkeydown="if(event.key==='Enter')PageDangNhap.dangNhap()">
                  <i class="fas fa-eye input-icon-right" onclick="PageDangNhap.doiHienMatKhau('dn-mat-khau', this)"></i>
                </div>
              </div>

              <button class="btn btn-primary btn-lg btn-block mb-2" id="nut-dang-nhap"
                      onclick="PageDangNhap.dangNhap()">
                <i class="fas fa-sign-in-alt"></i> Đăng nhập
              </button>
            </div>

            <!-- ─── FORM ĐĂNG KÝ ─── -->
            <div id="form-dang-ky" class="d-none">
              <h2 style="color:var(--c-navy);margin-bottom:6px">Tạo tài khoản mới</h2>
              <p class="text-muted mb-3">Đăng ký tài khoản bệnh nhân</p>

              <div class="form-alert error" id="loi-dang-ky"></div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Họ tên *</label>
                  <input id="dk-ho-ten" type="text" class="form-control" placeholder="Nguyễn Văn A">
                </div>
                <div class="form-group">
                  <label class="form-label">Ngày sinh</label>
                  <input id="dk-ngay-sinh" type="date" class="form-control">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Tên tài khoản *</label>
                  <input id="dk-tai-khoan" type="text" class="form-control" placeholder="ten_tai_khoan">
                </div>
                <div class="form-group">
                  <label class="form-label">Giới tính</label>
                  <select id="dk-gioi-tinh" class="form-control">
                    <option value="NAM">Nam</option>
                    <option value="NU">Nữ</option>
                    <option value="KHAC">Khác</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Email *</label>
                <div class="form-control-icon">
                  <i class="fas fa-envelope input-icon"></i>
                  <input id="dk-email" type="email" class="form-control" placeholder="email@example.com">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Địa chỉ *</label>
                <input id="dk-dia-chi" type="text" class="form-control" placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành">
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Số điện thoại *</label>
                  <div class="form-control-icon">
                    <i class="fas fa-phone input-icon"></i>
                    <input id="dk-sdt" type="tel" class="form-control" placeholder="0901234567">
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Mật khẩu * (≥6 ký tự)</label>
                  <div class="form-control-icon">
                    <i class="fas fa-lock input-icon"></i>
                    <input id="dk-mat-khau" type="password" class="form-control" placeholder="••••••••">
                    <i class="fas fa-eye input-icon-right" onclick="PageDangNhap.doiHienMatKhau('dk-mat-khau',this)"></i>
                  </div>
                </div>
              </div>

              <button class="btn btn-mint btn-lg btn-block" onclick="PageDangNhap.dangKy()">
                <i class="fas fa-user-plus"></i> Tạo tài khoản
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- auth styles: css/auth.css -->
    `;

    if (window.UIEnhance) window.UIEnhance.bindThemeToggles();

    // Focus field đầu tiên
    setTimeout(() => document.getElementById('dn-tai-khoan')?.focus(), 100);
  },

  doiTab(tab) {
    const tabDangNhap = document.getElementById('tab-dang-nhap');
    const tabDangKy = document.getElementById('tab-dang-ky');
    const formDangNhap = document.getElementById('form-dang-nhap');
    const formDangKy = document.getElementById('form-dang-ky');
    
    if (tabDangNhap) tabDangNhap.classList.toggle('active', tab === 'dang-nhap');
    if (tabDangKy) tabDangKy.classList.toggle('active', tab === 'dang-ky');
    if (formDangNhap) formDangNhap.classList.toggle('d-none', tab !== 'dang-nhap');
    if (formDangKy) formDangKy.classList.toggle('d-none', tab !== 'dang-ky');
  },

  doiHienMatKhau(inputId, icon) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const dang = input.type === 'password';
    input.type = dang ? 'text' : 'password';
    icon.className = `fas fa-${dang ? 'eye-slash' : 'eye'} input-icon-right`;
  },

  _hienLoi(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  },

  _anLoi(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  },

  async dangKy() {
        this._anLoi('loi-dang-ky');

        const flattenErrors = (obj, prefix = '') => {
            if (obj == null) return [];
            if (typeof obj === 'string') return [prefix ? `${prefix}: ${obj}` : obj];
            if (Array.isArray(obj)) return obj.flatMap((it) => flattenErrors(it, prefix));
            if (typeof obj === 'object') {
                return Object.entries(obj).flatMap(([k, v]) => flattenErrors(v, prefix ? `${prefix}.${k}` : k));
            }
            return [String(obj)];
        };

        let gioiTinh = (document.getElementById('dk-gioi-tinh')?.value || '').trim();
        // BE expects gioi_tinh in uppercase choices: NAM | NU | KHAC
        if (!gioiTinh) gioiTinh = 'KHAC';
        gioiTinh = gioiTinh.toUpperCase();

        const duLieu = {
            ten_dang_nhap: document.getElementById('dk-tai-khoan').value.trim(),
            ho_ten: document.getElementById('dk-ho-ten').value.trim(),
            email: document.getElementById('dk-email').value.trim(),
            so_dien_thoai: document.getElementById('dk-sdt').value.trim(),
            password: document.getElementById('dk-mat-khau').value,
            password2: document.getElementById('dk-mat-khau').value,  // Confirm password
            ngay_sinh: document.getElementById('dk-ngay-sinh').value || null,
            gioi_tinh: gioiTinh,
            dia_chi: document.getElementById('dk-dia-chi').value.trim(),
            vai_tro: 'BENH_NHAN'
        };

        // Validate
        if (!duLieu.ho_ten) {
            this._hienLoi('loi-dang-ky', 'Vui lòng nhập họ tên');
            return;
        }
        if (!duLieu.ten_dang_nhap) {
            this._hienLoi('loi-dang-ky', 'Vui lòng nhập tên đăng nhập');
            return;
        }
        if (!duLieu.email) {
            this._hienLoi('loi-dang-ky', 'Vui lòng nhập email');
            return;
        }
        if (!duLieu.so_dien_thoai) {
            this._hienLoi('loi-dang-ky', 'Vui lòng nhập số điện thoại');
            return;
        }
        if (!duLieu.ngay_sinh) {
            this._hienLoi('loi-dang-ky', 'Vui lòng nhập ngày sinh');
            return;
        }
        if (!duLieu.dia_chi) {
            this._hienLoi('loi-dang-ky', 'Vui lòng nhập địa chỉ');
            return;
        }
        if (duLieu.password.length < 8) {
            this._hienLoi('loi-dang-ky', 'Mật khẩu tối thiểu 8 ký tự');
            return;
        }
        if (!/[A-Z]/.test(duLieu.password) || !/\d/.test(duLieu.password) || !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(duLieu.password)) {
            this._hienLoi('loi-dang-ky', 'Mật khẩu cần ít nhất 1 chữ hoa, 1 số và 1 ký tự đặc biệt');
            return;
        }

        const btn = document.querySelector('#form-dang-ky button');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';

        const { ok, data } = await Auth.dangKy(duLieu);

        btn.disabled = false;
        btn.innerHTML = originalText;

        if (ok) {
            Toast.ok('Đăng ký thành công!', `Chào mừng ${duLieu.ho_ten} đến với PhòngKhám+`);
            setTimeout(() => {
                if (typeof App !== 'undefined' && App.khoidong) {
                    App.khoidong();
                }
            }, 600);
        } else {
            const msg = flattenErrors(data || {}).join('. ') || 'Đăng ký thất bại';
            this._hienLoi('loi-dang-ky', msg);
        }
    },

  async dangNhap() {
    const ten = document.getElementById('dn-tai-khoan').value.trim();
    const mk = document.getElementById('dn-mat-khau').value;
    this._anLoi('loi-dang-nhap');

    if (!ten || !mk) {
      this._hienLoi('loi-dang-nhap', 'Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }

    const btn = document.getElementById('nut-dang-nhap');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Đang đăng nhập...';
    }

    const { ok, data } = await Auth.dangNhap(ten, mk);

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Đăng nhập';
    }

    if (ok && data) {
      Toast.ok('Đăng nhập thành công', `Xin chào, ${data.ho_ten || ten}!`);
      const role = (data.vai_tro || '').toUpperCase();
      if (role === 'ADMIN') {
        window.location.href = '/admin-dashboard/';
      } else {
        window.location.href = '/';
      }
      return;
    }

    const flat =
      data && typeof data === 'object'
        ? data.detail ||
          data.non_field_errors?.[0] ||
          (Array.isArray(data.password) ? data.password[0] : null) ||
          (Array.isArray(data.ten_dang_nhap) ? data.ten_dang_nhap[0] : null)
        : null;
    this._hienLoi('loi-dang-nhap', flat || 'Sai tên đăng nhập hoặc mật khẩu');
  },
};

// Expose ra window để App.showLogin() nhìn thấy.
// Nếu không, App sẽ rơi về fallback login và bạn sẽ không thấy tab đăng ký + phần giới thiệu hệ thống.
window.PageDangNhap = PageDangNhap;