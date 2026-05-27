"""Xuất báo cáo tài chính — PDF, Word, Excel, CSV."""
import csv
import io
import os
from datetime import datetime
from typing import Dict, List, Tuple

from django.http import HttpResponse


def _pdf_font_name() -> str:
    """Đăng ký font Unicode (tiếng Việt) nếu có trên máy chủ."""
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        if pdfmetrics.getRegisteredFontNames() and 'VNFont' in pdfmetrics.getRegisteredFontNames():
            return 'VNFont'
        candidates = [
            os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'arial.ttf'),
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        ]
        for path in candidates:
            if os.path.isfile(path):
                pdfmetrics.registerFont(TTFont('VNFont', path))
                return 'VNFont'
    except Exception:
        pass
    return 'Helvetica'


def _meta(data: dict, request) -> Dict[str, str]:
    now = datetime.now().strftime('%d/%m/%Y %H:%M')
    return {
        'co_quan_chu_quan': 'BỘ Y TẾ',
        'don_vi': 'CƠ SỞ KHÁM CHỮA BỆNH',
        'ten_bao_cao': 'BÁO CÁO THỐNG KÊ TÀI CHÍNH VÀ DOANH THU',
        'ky_bao_cao': data.get('ky_bao_cao') or f"{data.get('tu')} — {data.get('den')}",
        'nguoi_xuat': getattr(request.user, 'ho_ten', '') or getattr(request.user, 'ten_dang_nhap', ''),
        'thoi_diem_xuat': now,
        'so_hieu_bieu_mau': 'BM-BV-TC-01',
        'nhom': data.get('nhom') or 'ngay',
    }


def _money(v) -> str:
    try:
        return f'{float(v or 0):,.0f}'
    except (TypeError, ValueError):
        return str(v)


def _summary_rows(data: dict) -> List[Tuple[str, str]]:
    return [
        ('Tổng doanh thu', _money(data.get('doanh_thu'))),
        ('Doanh thu — đơn hàng (app/quầy)', _money(data.get('doanh_thu_don_hang'))),
        ('Doanh thu — đơn thuốc toa', _money(data.get('doanh_thu_don_thuoc'))),
        ('Doanh thu — tiêm chủng', _money(data.get('doanh_thu_tiem'))),
        ('Giá vốn ước tính', _money(data.get('gia_von_uoc_tinh'))),
        ('Lợi nhuận ước tính', _money(data.get('loi_nhuan_uoc_tinh'))),
        ('Số giao dịch', str(data.get('so_giao_dich') or 0)),
    ]


def _detail_headers(nhom: str) -> List[str]:
    if nhom == 'bac_si':
        return [
            'Mã BS',
            'Bác sĩ',
            'Đơn hàng',
            'Đơn toa',
            'Tiêm',
            'Tổng DT',
            'SL đơn',
            'SL toa',
            'SL tiêm',
        ]
    if nhom == 'thang':
        return ['Tháng', 'Đơn hàng', 'Đơn toa', 'Tiêm', 'Tổng']
    if nhom == 'nam':
        return ['Năm', 'Đơn hàng', 'Đơn toa', 'Tiêm', 'Tổng']
    return ['Ngày', 'Đơn hàng', 'Đơn toa', 'Tiêm', 'Tổng']


def _detail_rows(data: dict) -> List[List[str]]:
    nhom = data.get('nhom') or 'ngay'
    rows = data.get('bang_chi_tiet') or data.get('theo_ngay') or []
    out: List[List[str]] = []
    if nhom == 'bac_si':
        for r in rows:
            out.append([
                r.get('ma_bac_si') or '',
                r.get('ten_bac_si') or '',
                _money(r.get('doanh_thu_don_hang')),
                _money(r.get('doanh_thu_don_thuoc')),
                _money(r.get('doanh_thu_tiem')),
                _money(r.get('tong_doanh_thu')),
                str(r.get('so_don_hang') or 0),
                str(r.get('so_don_thuoc') or 0),
                str(r.get('so_lan_tiem') or 0),
            ])
        return out
    label_key = {'thang': 'thang', 'nam': 'nam'}.get(nhom, 'ngay')
    for r in rows:
        out.append([
            r.get(label_key) or r.get('ngay') or '',
            _money(r.get('doanh_thu_don_hang')),
            _money(r.get('doanh_thu_don_thuoc')),
            _money(r.get('doanh_thu_tiem')),
            _money(r.get('tong_doanh_thu')),
        ])
    return out


def _filename(data: dict, ext: str) -> str:
    tu = (data.get('tu') or 'tu').replace('-', '')
    den = (data.get('den') or 'den').replace('-', '')
    nhom = data.get('nhom') or 'ngay'
    return f'bao-cao-tai-chinh_{tu}_{den}_{nhom}.{ext}'


def export_financial_csv(data: dict, request) -> HttpResponse:
    meta = _meta(data, request)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([meta['co_quan_chu_quan']])
    w.writerow([meta['don_vi']])
    w.writerow([meta['ten_bao_cao']])
    w.writerow(['Biểu mẫu', meta['so_hieu_bieu_mau']])
    w.writerow(['Kỳ báo cáo', meta['ky_bao_cao']])
    w.writerow(['Nhóm chi tiết', meta['nhom']])
    w.writerow(['Người xuất', meta['nguoi_xuat']])
    w.writerow(['Thời điểm xuất', meta['thoi_diem_xuat']])
    w.writerow([])
    w.writerow(['Chỉ tiêu', 'Giá trị'])
    for label, val in _summary_rows(data):
        w.writerow([label, val])
    w.writerow([])
    w.writerow(_detail_headers(meta['nhom']))
    for row in _detail_rows(data):
        w.writerow(row)
    resp = HttpResponse('\ufeff' + buf.getvalue(), content_type='text/csv; charset=utf-8')
    resp['Content-Disposition'] = f'attachment; filename="{_filename(data, "csv")}"'
    return resp


def export_financial_xlsx(data: dict, request) -> HttpResponse:
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font
    except ImportError:
        return HttpResponse(
            '{"error":"Thiếu thư viện openpyxl. Chạy: pip install openpyxl"}',
            content_type='application/json',
            status=503,
        )

    meta = _meta(data, request)
    wb = Workbook()
    ws = wb.active
    ws.title = 'Tong hop'
    bold = Font(bold=True)
    ws.append([meta['co_quan_chu_quan']])
    ws.append([meta['don_vi']])
    ws.append([meta['ten_bao_cao']])
    ws.append(['Biểu mẫu', meta['so_hieu_bieu_mau']])
    ws.append(['Kỳ báo cáo', meta['ky_bao_cao']])
    ws.append(['Nhóm chi tiết', meta['nhom']])
    ws.append(['Người xuất', meta['nguoi_xuat']])
    ws.append(['Thời điểm xuất', meta['thoi_diem_xuat']])
    ws.append([])
    ws.append(['Chỉ tiêu', 'Giá trị'])
    ws['A10'].font = bold
    ws['B10'].font = bold
    for label, val in _summary_rows(data):
        ws.append([label, val])
    ws.append([])
    hdr = _detail_headers(meta['nhom'])
    ws.append(hdr)
    for c in range(1, len(hdr) + 1):
        ws.cell(row=ws.max_row, column=c).font = bold
    for row in _detail_rows(data):
        ws.append(row)

    ws2 = wb.create_sheet('Top thuoc')
    ws2.append(['Nguồn', 'Tên thuốc', 'SL', 'Doanh thu'])
    for x in data.get('top_thuoc_don_hang') or []:
        ws2.append(['Đơn hàng', x.get('ten_thuoc'), x.get('so_luong'), x.get('doanh_thu')])
    for x in data.get('top_thuoc_theo_toa') or []:
        ws2.append(['Theo toa', x.get('ten_thuoc'), x.get('so_luong'), x.get('doanh_thu')])

    bio = io.BytesIO()
    wb.save(bio)
    bio.seek(0)
    resp = HttpResponse(
        bio.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    resp['Content-Disposition'] = f'attachment; filename="{_filename(data, "xlsx")}"'
    return resp


def export_financial_docx(data: dict, request) -> HttpResponse:
    try:
        from docx import Document
    except ImportError:
        return HttpResponse(
            '{"error":"Thiếu thư viện python-docx. Chạy: pip install python-docx"}',
            content_type='application/json',
            status=503,
        )

    meta = _meta(data, request)
    doc = Document()
    doc.add_paragraph(meta['co_quan_chu_quan'])
    doc.add_paragraph(meta['don_vi'])
    doc.add_heading(meta['ten_bao_cao'], level=1)
    doc.add_paragraph(f"Biểu mẫu: {meta['so_hieu_bieu_mau']}")
    doc.add_paragraph(f"Kỳ báo cáo: {meta['ky_bao_cao']}")
    doc.add_paragraph(f"Nhóm chi tiết: {meta['nhom']}")
    doc.add_paragraph(f"Người xuất: {meta['nguoi_xuat']}")
    doc.add_paragraph(f"Thời điểm xuất: {meta['thoi_diem_xuat']}")

    t1 = doc.add_table(rows=1, cols=2)
    t1.rows[0].cells[0].text = 'Chỉ tiêu'
    t1.rows[0].cells[1].text = 'Giá trị'
    for label, val in _summary_rows(data):
        row = t1.add_row().cells
        row[0].text = label
        row[1].text = val

    doc.add_heading('Chi tiết theo ' + meta['nhom'], level=2)
    hdr = _detail_headers(meta['nhom'])
    t2 = doc.add_table(rows=1, cols=len(hdr))
    for i, h in enumerate(hdr):
        t2.rows[0].cells[i].text = h
    for row in _detail_rows(data):
        cells = t2.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = val

    bio = io.BytesIO()
    doc.save(bio)
    bio.seek(0)
    resp = HttpResponse(
        bio.read(),
        content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    resp['Content-Disposition'] = f'attachment; filename="{_filename(data, "docx")}"'
    return resp


def export_financial_pdf(data: dict, request) -> HttpResponse:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError:
        return HttpResponse(
            '{"error":"Thiếu thư viện reportlab. Chạy: pip install reportlab"}',
            content_type='application/json',
            status=503,
        )

    try:
        meta = _meta(data, request)
        font = _pdf_font_name()
        bio = io.BytesIO()
        doc = SimpleDocTemplate(
            bio, pagesize=landscape(A4), leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36
        )
        styles = getSampleStyleSheet()
        normal = ParagraphStyle('VN', parent=styles['Normal'], fontName=font, fontSize=10)
        story = []
        for line in (
            meta['co_quan_chu_quan'],
            meta['don_vi'],
            meta['ten_bao_cao'],
            f"Biểu mẫu: {meta['so_hieu_bieu_mau']}",
            f"Kỳ: {meta['ky_bao_cao']} | Nhóm: {meta['nhom']}",
            f"Người xuất: {meta['nguoi_xuat']} | {meta['thoi_diem_xuat']}",
        ):
            story.append(Paragraph(line.replace('&', '&amp;'), normal))
        story.append(Spacer(1, 12))

        sum_data = [['Chỉ tiêu', 'Giá trị']] + [[a, b] for a, b in _summary_rows(data)]
        t1 = Table(sum_data, colWidths=[220, 120])
        t1.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a365d')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTNAME', (0, 0), (-1, -1), font),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
        ]))
        story.append(t1)
        story.append(Spacer(1, 16))

        hdr = _detail_headers(meta['nhom'])
        detail = [hdr] + _detail_rows(data)
        t2 = Table(detail, repeatRows=1)
        t2.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0e7490')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTNAME', (0, 0), (-1, -1), font),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
        ]))
        story.append(t2)
        doc.build(story)
        bio.seek(0)
        resp = HttpResponse(bio.read(), content_type='application/pdf')
        resp['Content-Disposition'] = f'attachment; filename="{_filename(data, "pdf")}"'
        return resp
    except Exception as exc:
        return HttpResponse(
            f'{{"error":"Lỗi tạo PDF: {str(exc)[:200]}"}}',
            content_type='application/json',
            status=500,
        )


EXPORTERS = {
    'csv': export_financial_csv,
    'xlsx': export_financial_xlsx,
    'excel': export_financial_xlsx,
    'docx': export_financial_docx,
    'word': export_financial_docx,
    'pdf': export_financial_pdf,
}


def export_financial(data: dict, request, fmt: str) -> HttpResponse:
    key = (fmt or '').lower().strip()
    fn = EXPORTERS.get(key)
    if not fn:
        return HttpResponse(
            '{"error":"dinh_dang phải là pdf, docx, xlsx hoặc csv"}',
            content_type='application/json',
            status=400,
        )
    try:
        return fn(data, request)
    except Exception as exc:
        return HttpResponse(
            f'{{"error":"Lỗi xuất file: {str(exc)[:200]}"}}',
            content_type='application/json',
            status=500,
        )
