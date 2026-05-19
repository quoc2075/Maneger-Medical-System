from django.conf import settings
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Q, Sum, Count, F, Value, Min, DecimalField, DateTimeField
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from rest_framework import viewsets, status, generics, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from nguoidung.roles import (
    la_quan_ly_kho,
    la_ke_toan,
    la_admin_he_thong,
)
from .models import *
from .serializers import *
import logging

logger = logging.getLogger(__name__)


def _cap_nhat_kho_tu_phieu_nhap(phieu_nhap):
    """Tạo bản ghi tồn kho theo chi tiết phiếu nhập (một lần cho mỗi phiếu)."""
    if phieu_nhap.da_cap_nhat_kho:
        return
    if phieu_nhap.loai_nhap == 'THUOC':
        for chi_tiet in phieu_nhap.chi_tiet_thuoc.all():
            KhoThuoc.objects.create(
                thuoc=chi_tiet.thuoc,
                so_luong=chi_tiet.so_luong,
                ngay_nhap=phieu_nhap.ngay_chung_tu,
                han_su_dung=chi_tiet.han_su_dung,
                lo_sx=chi_tiet.lo_sx,
            )
    else:
        for chi_tiet in phieu_nhap.chi_tiet_vaccine.all():
            KhoVaccine.objects.create(
                vaccine=chi_tiet.vaccine,
                so_luong=chi_tiet.so_luong,
                ngay_nhap=phieu_nhap.ngay_chung_tu,
                han_su_dung=chi_tiet.han_su_dung,
                lo_sx=chi_tiet.lo_sx,
            )


class ThuocVaccineCatalogPagination(PageNumberPagination):
    """Cho phép client truyền ?page_size= (mặc định DRF chỉ trả 20 bản ghi, bỏ qua page_size)."""
    page_size = 60
    page_size_query_param = 'page_size'
    max_page_size = 200


# ==================== VIEWSETS CHO CÁC MODEL CƠ BẢN ====================

class LoaiThuocViewSet(viewsets.ModelViewSet):
    """API cho loại thuốc"""
    queryset = LoaiThuoc.objects.all()
    serializer_class = LoaiThuocSerializer
    pagination_class = None
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['ten_loai', 'mo_ta']
    ordering_fields = ['ten_loai']

    def create(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được thao tác danh mục loại thuốc.')
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được thao tác danh mục loại thuốc.')
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được thao tác danh mục loại thuốc.')
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được thao tác danh mục loại thuốc.')
        return super().destroy(request, *args, **kwargs)

class DonViTinhViewSet(viewsets.ModelViewSet):
    """API cho đơn vị tính"""
    queryset = DonViTinh.objects.all()
    serializer_class = DonViTinhSerializer
    pagination_class = None
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['ten_don_vi', 'ky_hieu']

class NhaCungCapViewSet(viewsets.ModelViewSet):
    """API cho nhà cung cấp"""
    queryset = NhaCungCap.objects.all()
    serializer_class = NhaCungCapSerializer
    pagination_class = ThuocVaccineCatalogPagination
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['trang_thai']
    search_fields = ['ma_ncc', 'ten_ncc', 'so_dien_thoai', 'email']
    ordering_fields = ['ten_ncc', 'created_at']

    def create(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được thêm nhà cung cấp.')
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được sửa nhà cung cấp.')
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được sửa nhà cung cấp.')
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được xóa nhà cung cấp.')
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def thuoc_cung_cap(self, request, pk=None):
        """Lấy danh sách thuốc do nhà cung cấp này cung cấp"""
        nha_cung_cap = self.get_object()
        thuoc = nha_cung_cap.thuoc_set.all()
        page = self.paginate_queryset(thuoc)
        if page is not None:
            serializer = ThuocSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = ThuocSerializer(thuoc, many=True)
        return Response(serializer.data)

# ==================== VIEWSETS CHO THUỐC ====================

class ThuocViewSet(viewsets.ModelViewSet):
    """API cho thuốc"""
    queryset = Thuoc.objects.select_related('loai_thuoc', 'don_vi').prefetch_related(
        'kho_thuoc', 'nha_cung_cap', 'lich_su_gia'
    ).all()
    serializer_class = ThuocSerializer
    pagination_class = ThuocVaccineCatalogPagination
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['loai_thuoc', 'trang_thai', 'can_don_thuoc', 'can_tu_van', 'la_thuoc_ban_chay']
    search_fields = ['ma_thuoc', 'ten_thuoc', 'nha_san_xuat', 'thanh_phan']
    ordering_fields = ['ten_thuoc', 'gia_ban', 'created_at', 'ton_kho']

    def get_pagination_class(self):
        # Bệnh nhân cần danh sách đầy đủ trên cửa hàng (tránh cắt theo PAGE_SIZE / max_page_size).
        u = self.request.user
        if getattr(u, 'is_authenticated', False) and getattr(u, 'vai_tro', None) == 'BENH_NHAN':
            return None
        return ThuocVaccineCatalogPagination

    def get_queryset(self):
        """Custom queryset với filter đặc biệt"""
        queryset = super().get_queryset()
        # Bệnh nhân chỉ được xem thuốc đang kinh doanh và không cần kê đơn.
        if getattr(self.request.user, 'vai_tro', None) == 'BENH_NHAN':
            queryset = queryset.filter(trang_thai=True, can_don_thuoc=False)
        
        # Filter theo khoảng giá
        gia_tu = self.request.query_params.get('gia_tu')
        gia_den = self.request.query_params.get('gia_den')
        if gia_tu:
            queryset = queryset.filter(gia_ban__gte=gia_tu)
        if gia_den:
            queryset = queryset.filter(gia_ban__lte=gia_den)
        
        # Filter theo tồn kho
        ton_kho = self.request.query_params.get('ton_kho')
        if ton_kho == 'con_hang':
            # Lọc thuốc còn hàng (tồn kho > 0)
            thuoc_ids = [t.id for t in queryset if t.ton_kho() > 0]
            queryset = queryset.filter(id__in=thuoc_ids)
        elif ton_kho == 'het_hang':
            thuoc_ids = [t.id for t in queryset if t.ton_kho() == 0]
            queryset = queryset.filter(id__in=thuoc_ids)
        
        return queryset

    @action(detail=False, methods=['get'])
    def thong_ke(self, request):
        """Thống kê tổng quan về thuốc"""
        total = self.get_queryset().count()
        con_hang = sum(1 for t in self.get_queryset() if t.ton_kho() > 0)
        het_hang = total - con_hang
        sap_het_han = Thuoc.objects.filter(
            kho_thuoc__han_su_dung__lte=date.today() + timedelta(days=90),
            kho_thuoc__han_su_dung__gt=date.today()
        ).distinct().count()
        
        # Thống kê theo loại
        thong_ke_loai = LoaiThuoc.objects.annotate(
            so_luong=Count('thuoc')
        ).values('ten_loai', 'so_luong')
        
        return Response({
            'tong_thuoc': total,
            'con_hang': con_hang,
            'het_hang': het_hang,
            'sap_het_han': sap_het_han,
            'thong_ke_loai': thong_ke_loai
        })

    @action(detail=True, methods=['get'])
    def chi_tiet_ton_kho(self, request, pk=None):
        """Xem chi tiết tồn kho của thuốc"""
        thuoc = self.get_object()
        kho = thuoc.kho_thuoc.all().order_by('han_su_dung')
        
        # Tính toán thống kê
        tong_ton = sum(k.so_luong for k in kho)
        con_han = kho.filter(han_su_dung__gt=date.today())
        tong_con_han = sum(k.so_luong for k in con_han)
        het_han = kho.filter(han_su_dung__lte=date.today())
        tong_het_han = sum(k.so_luong for k in het_han)
        sap_het_han = kho.filter(
            han_su_dung__lte=date.today() + timedelta(days=90),
            han_su_dung__gt=date.today()
        )
        tong_sap_het_han = sum(k.so_luong for k in sap_het_han)
        
        serializer = KhoThuocSerializer(kho, many=True)
        
        return Response({
            'thuoc': ThuocSerializer(thuoc).data,
            'tong_ton': tong_ton,
            'con_han': tong_con_han,
            'het_han': tong_het_han,
            'sap_het_han': tong_sap_het_han,
            'chi_tiet': serializer.data
        })

    @action(detail=True, methods=['post'])
    def cap_nhat_gia(self, request, pk=None):
        """Cập nhật giá thuốc và lưu lịch sử (kế toán hoặc admin)."""
        if not (la_ke_toan(request.user) or la_admin_he_thong(request.user)):
            raise PermissionDenied('Chỉ kế toán hoặc quản trị viên được cập nhật giá bán.')
        thuoc = self.get_object()
        gia_moi = request.data.get('gia_moi')
        ly_do = request.data.get('ly_do', '')
        
        if not gia_moi:
            return Response(
                {'error': 'Vui lòng nhập giá mới'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Lưu lịch sử giá
        LichSuGiaThuoc.objects.create(
            thuoc=thuoc,
            gia_cu=thuoc.gia_ban,
            gia_moi=gia_moi,
            nguoi_thay_doi=getattr(request.user, 'ten_dang_nhap', '') or str(request.user.pk),
            ly_do=ly_do
        )
        
        # Cập nhật giá mới
        thuoc.gia_ban = gia_moi
        thuoc.save()
        
        return Response({
            'message': 'Cập nhật giá thành công',
            'gia_moi': float(gia_moi),
            'data': ThuocSerializer(thuoc).data,
        })

    @action(detail=False, methods=['get'])
    def tim_kiem_nang_cao(self, request):
        """Tìm kiếm thuốc nâng cao"""
        query = request.query_params.get('q', '')
        loai_thuoc = request.query_params.get('loai_thuoc')
        gia_toi_da = request.query_params.get('gia_toi_da')
        chi_dinh = request.query_params.get('chi_dinh')
        
        thuoc = self.get_queryset()
        
        if query:
            thuoc = thuoc.filter(
                Q(ma_thuoc__icontains=query) |
                Q(ten_thuoc__icontains=query) |
                Q(thanh_phan__icontains=query) |
                Q(nha_san_xuat__icontains=query)
            )
        
        if loai_thuoc:
            thuoc = thuoc.filter(loai_thuoc_id=loai_thuoc)
        
        if gia_toi_da:
            thuoc = thuoc.filter(gia_ban__lte=gia_toi_da)
        
        if chi_dinh:
            thuoc = thuoc.filter(chi_dinh__icontains=chi_dinh)
        
        serializer = self.get_serializer(thuoc, many=True)
        return Response(serializer.data)

class KhoThuocViewSet(viewsets.ModelViewSet):
    """API cho kho thuốc"""
    queryset = KhoThuoc.objects.select_related('thuoc').all()
    serializer_class = KhoThuocSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['thuoc', 'han_su_dung']
    search_fields = ['thuoc__ten_thuoc', 'thuoc__ma_thuoc', 'lo_sx']
    ordering_fields = ['ngay_nhap', 'han_su_dung', 'so_luong']

    def perform_create(self, serializer):
        if not la_admin_he_thong(self.request.user):
            raise PermissionDenied(
                'Nhập trực tiếp vào kho chỉ dành cho quản trị viên. '
                'Nhân viên kho vui lòng tạo phiếu nhập kho và chờ kế toán duyệt.'
            )
        serializer.save()

    def perform_update(self, serializer):
        if not la_quan_ly_kho(self.request.user):
            raise PermissionDenied('Chỉ nhân viên quản lý kho hoặc quản trị viên được sửa lô kho.')
        serializer.save()

    def perform_destroy(self, instance):
        if not la_quan_ly_kho(self.request.user):
            raise PermissionDenied('Chỉ nhân viên quản lý kho hoặc quản trị viên được xóa lô kho.')
        instance.delete()

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter theo trạng thái hạn
        trang_thai = self.request.query_params.get('trang_thai')
        if trang_thai == 'con_han':
            queryset = queryset.filter(han_su_dung__gt=date.today())
        elif trang_thai == 'het_han':
            queryset = queryset.filter(han_su_dung__lte=date.today())
        elif trang_thai == 'sap_het_han':
            queryset = queryset.filter(
                han_su_dung__lte=date.today() + timedelta(days=90),
                han_su_dung__gt=date.today()
            )
        
        return queryset

    @action(detail=True, methods=['post'], url_path='xuat-sl')
    def xuat_sl(self, request, pk=None):
        """Xuất kho theo lô (giảm số lượng)."""
        if not la_quan_ly_kho(request.user):
            raise PermissionDenied('Chỉ nhân viên quản lý kho hoặc quản trị viên được xuất kho.')
        kho = self.get_object()
        try:
            sl = int(request.data.get('so_luong', 0) or 0)
        except (TypeError, ValueError):
            sl = 0
        if sl <= 0:
            return Response({'error': 'Số lượng xuất phải lớn hơn 0'}, status=status.HTTP_400_BAD_REQUEST)
        if sl > kho.so_luong:
            return Response({'error': 'Số lượng xuất vượt tồn lô'}, status=status.HTTP_400_BAD_REQUEST)
        kho.so_luong -= sl
        kho.save(update_fields=['so_luong'])
        return Response(KhoThuocSerializer(kho).data)

    @action(detail=False, methods=['get'])
    def bao_cao_sap_het_han(self, request):
        """Báo cáo thuốc sắp hết hạn"""
        ngay_canh_bao = date.today() + timedelta(days=90)
        kho_sap_het_han = self.get_queryset().filter(
            han_su_dung__lte=ngay_canh_bao,
            han_su_dung__gt=date.today()
        ).order_by('han_su_dung')
        
        serializer = self.get_serializer(kho_sap_het_han, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def bao_cao_ton_kho(self, request):
        """Báo cáo tồn kho tổng hợp"""
        # Tồn kho theo thuốc
        ton_kho_theo_thuoc = KhoThuoc.objects.filter(
            han_su_dung__gt=date.today()
        ).values(
            'thuoc__ma_thuoc',
            'thuoc__ten_thuoc'
        ).annotate(
            tong_ton=Sum('so_luong'),
            so_lo=Count('id'),
            ngay_het_han_gan_nhat=Min('han_su_dung')
        ).order_by('-tong_ton')
        
        # Thống kê tổng quan
        tong_gia_tri_ton = KhoThuoc.objects.filter(
            han_su_dung__gt=date.today()
        ).aggregate(
            tong=Sum(F('so_luong') * F('thuoc__don_gia_nhap'))
        )['tong'] or 0
        
        return Response({
            'tong_gia_tri_ton': tong_gia_tri_ton,
            'chi_tiet': ton_kho_theo_thuoc
        })

# ==================== VIEWSETS CHO VACCINE ====================

class LoaiVaccineViewSet(viewsets.ModelViewSet):
    """API cho loại vaccine — CRUD danh mục: chỉ Admin."""
    queryset = LoaiVaccine.objects.all()
    serializer_class = LoaiVaccineSerializer
    pagination_class = None
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['ten_loai', 'mo_ta']
    ordering_fields = ['ten_loai']

    def create(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được thao tác danh mục loại vaccine.')
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được thao tác danh mục loại vaccine.')
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được thao tác danh mục loại vaccine.')
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được thao tác danh mục loại vaccine.')
        return super().destroy(request, *args, **kwargs)

class VaccineViewSet(viewsets.ModelViewSet):
    """API cho vaccine"""
    queryset = Vaccine.objects.select_related('loai_vaccine', 'nha_cung_cap').prefetch_related(
        'kho_vaccine', 'lich_su_gia'
    ).all()
    serializer_class = VaccineSerializer
    pagination_class = ThuocVaccineCatalogPagination
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['loai_vaccine', 'trang_thai', 'so_mui']
    search_fields = ['ma_vaccine', 'ten_vaccine', 'nha_san_xuat', 'phong_benh']
    ordering_fields = ['ten_vaccine', 'gia_tiem', 'created_at']

    def get_pagination_class(self):
        u = self.request.user
        if getattr(u, 'is_authenticated', False) and getattr(u, 'vai_tro', None) == 'BENH_NHAN':
            return None
        return ThuocVaccineCatalogPagination

    def create(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được thao tác danh mục vaccine.')
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được thao tác danh mục vaccine.')
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được thao tác danh mục vaccine.')
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not la_admin_he_thong(request.user):
            raise PermissionDenied('Chỉ quản trị viên được thao tác danh mục vaccine.')
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def cap_nhat_gia(self, request, pk=None):
        """Cập nhật giá tiêm / giá nhập vaccine (kế toán hoặc admin)."""
        if not (la_ke_toan(request.user) or la_admin_he_thong(request.user)):
            raise PermissionDenied('Chỉ kế toán hoặc quản trị viên được cập nhật giá.')
        vaccine = self.get_object()
        gia_tiem_moi = request.data.get('gia_tiem_moi')
        gia_nhap_moi = request.data.get('gia_nhap_moi')
        ly_do = request.data.get('ly_do', '')
        if gia_tiem_moi is None and gia_nhap_moi is None:
            return Response(
                {'error': 'Vui lòng gửi gia_tiem_moi hoặc gia_nhap_moi'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if gia_tiem_moi is not None:
            LichSuGiaVaccine.objects.create(
                vaccine=vaccine,
                gia_cu=vaccine.gia_tiem,
                gia_moi=gia_tiem_moi,
                nguoi_thay_doi=getattr(request.user, 'ten_dang_nhap', '') or str(request.user.pk),
                ly_do=ly_do
            )
            vaccine.gia_tiem = gia_tiem_moi
        if gia_nhap_moi is not None:
            vaccine.gia_nhap = gia_nhap_moi
        vaccine.save()
        return Response({'message': 'Cập nhật giá thành công', 'data': VaccineSerializer(vaccine).data})

    @action(detail=True, methods=['get'])
    def lich_tiem(self, request, pk=None):
        """Xem lịch tiêm chi tiết của vaccine"""
        vaccine = self.get_object()
        lich_tiem = vaccine.get_lich_tiem()
        
        return Response({
            'ten_vaccine': vaccine.ten_vaccine,
            'so_mui': vaccine.so_mui,
            'lich_tiem': lich_tiem,
            'khoang_cach_mui': vaccine.khoang_cach_mui
        })

    @action(detail=False, methods=['get'])
    def thong_ke(self, request):
        """Thống kê vaccine"""
        total = self.get_queryset().count()
        
        # Thống kê theo loại
        thong_ke_loai = LoaiVaccine.objects.annotate(
            so_luong=Count('vaccine')
        ).values('ten_loai', 'so_luong')
        
        # Tồn kho
        tong_ton = KhoVaccine.objects.filter(
            han_su_dung__gt=date.today()
        ).aggregate(
            tong=Sum('so_luong')
        )['tong'] or 0
        
        return Response({
            'tong_vaccine': total,
            'tong_ton_kho': tong_ton,
            'thong_ke_loai': thong_ke_loai
        })

class KhoVaccineViewSet(viewsets.ModelViewSet):
    """API cho kho vaccine"""
    queryset = KhoVaccine.objects.select_related('vaccine').all()
    serializer_class = KhoVaccineSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['vaccine', 'han_su_dung']
    search_fields = ['vaccine__ten_vaccine', 'lo_sx']

    def perform_create(self, serializer):
        if not la_admin_he_thong(self.request.user):
            raise PermissionDenied(
                'Nhập trực tiếp vào kho chỉ dành cho quản trị viên. '
                'Nhân viên kho vui lòng tạo phiếu nhập kho và chờ kế toán duyệt.'
            )
        serializer.save()

    def perform_update(self, serializer):
        if not la_quan_ly_kho(self.request.user):
            raise PermissionDenied('Chỉ nhân viên quản lý kho hoặc quản trị viên được sửa lô kho.')
        serializer.save()

    def perform_destroy(self, instance):
        if not la_quan_ly_kho(self.request.user):
            raise PermissionDenied('Chỉ nhân viên quản lý kho hoặc quản trị viên được xóa lô kho.')
        instance.delete()

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter vaccine còn hạn
        con_han = self.request.query_params.get('con_han')
        if con_han == 'true':
            queryset = queryset.filter(han_su_dung__gt=date.today())
        
        return queryset

    @action(detail=True, methods=['post'], url_path='xuat-sl')
    def xuat_sl(self, request, pk=None):
        """Xuất kho vaccine theo lô."""
        if not la_quan_ly_kho(request.user):
            raise PermissionDenied('Chỉ nhân viên quản lý kho hoặc quản trị viên được xuất kho.')
        kho = self.get_object()
        try:
            sl = int(request.data.get('so_luong', 0) or 0)
        except (TypeError, ValueError):
            sl = 0
        if sl <= 0:
            return Response({'error': 'Số lượng xuất phải lớn hơn 0'}, status=status.HTTP_400_BAD_REQUEST)
        if sl > kho.so_luong:
            return Response({'error': 'Số lượng xuất vượt tồn lô'}, status=status.HTTP_400_BAD_REQUEST)
        kho.so_luong -= sl
        kho.save(update_fields=['so_luong'])
        return Response(KhoVaccineSerializer(kho).data)

# ==================== VIEWSETS CHO NHẬP KHO ====================

class PhieuNhapKhoViewSet(viewsets.ModelViewSet):
    """API cho phiếu nhập kho"""
    queryset = PhieuNhapKho.objects.select_related('nha_cung_cap').prefetch_related(
        'chi_tiet_thuoc', 'chi_tiet_vaccine'
    ).all()
    serializer_class = PhieuNhapKhoSerializer
    pagination_class = ThuocVaccineCatalogPagination
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['loai_nhap', 'nha_cung_cap', 'da_thanh_toan', 'da_duyet_chi', 'da_cap_nhat_kho']
    search_fields = ['ma_phieu', 'so_chung_tu', 'nha_cung_cap__ten_ncc']
    ordering_fields = ['ngay_nhap', 'tong_tien']

    def perform_create(self, serializer):
        """Tạo phiếu nhập — tồn kho chỉ cập nhật sau khi kế toán duyệt phiếu."""
        if not la_quan_ly_kho(self.request.user):
            raise PermissionDenied('Chỉ nhân viên quản lý kho hoặc quản trị viên được tạo phiếu nhập.')
        # NguoiDung dùng USERNAME_FIELD = ten_dang_nhap — không có .username
        serializer.save(nguoi_nhap=self.request.user.get_username())

    @action(detail=True, methods=['post'])
    def xac_nhan_thanh_toan(self, request, pk=None):
        """Xác nhận đã thanh toán phiếu nhập"""
        if not (la_ke_toan(request.user) or la_admin_he_thong(request.user)):
            raise PermissionDenied('Chỉ kế toán hoặc quản trị viên được xác nhận thanh toán.')
        phieu_nhap = self.get_object()
        phieu_nhap.da_thanh_toan = True
        phieu_nhap.save()
        
        return Response({'message': 'Đã xác nhận thanh toán'})

    @action(detail=True, methods=['post'])
    def duyet_chi(self, request, pk=None):
        """Kế toán duyệt phiếu nhập: ghi nhận chi phí và cập nhật tồn kho."""
        if not (la_ke_toan(request.user) or la_admin_he_thong(request.user)):
            raise PermissionDenied('Chỉ kế toán hoặc quản trị viên được duyệt phiếu nhập.')
        with transaction.atomic():
            phieu_nhap = self.get_queryset().select_for_update().get(pk=pk)
            if phieu_nhap.da_duyet_chi:
                return Response({'detail': 'Phiếu đã được duyệt trước đó.'}, status=status.HTTP_400_BAD_REQUEST)
            _cap_nhat_kho_tu_phieu_nhap(phieu_nhap)
            phieu_nhap.da_cap_nhat_kho = True
            phieu_nhap.da_duyet_chi = True
            phieu_nhap.nguoi_duyet_chi = getattr(request.user, 'ten_dang_nhap', '') or str(request.user.pk)
            phieu_nhap.ngay_duyet_chi = timezone.now()
            phieu_nhap.save(
                update_fields=[
                    'da_cap_nhat_kho',
                    'da_duyet_chi',
                    'nguoi_duyet_chi',
                    'ngay_duyet_chi',
                ]
            )
        phieu_nhap = self.get_queryset().prefetch_related(
            'chi_tiet_thuoc', 'chi_tiet_vaccine'
        ).get(pk=pk)
        return Response(PhieuNhapKhoSerializer(phieu_nhap).data)

# ==================== VIEWSETS CHO TOA THUỐC MẪU ====================

class ToaThuocMauViewSet(viewsets.ModelViewSet):
    """API cho toa thuốc mẫu"""
    queryset = ToaThuocMau.objects.prefetch_related(
        'chi_tiet__thuoc'
    ).all()
    serializer_class = ToaThuocMauSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['ma_toa', 'ten_toa', 'chuan_doan']

    @action(detail=True, methods=['get'])
    def tinh_tien(self, request, pk=None):
        """Tính tổng tiền của toa thuốc mẫu"""
        toa_thuoc = self.get_object()
        tong_tien = 0
        chi_tiet = []
        
        for ct in toa_thuoc.chi_tiet.all():
            thanh_tien = ct.so_luong * ct.thuoc.gia_ban
            tong_tien += thanh_tien
            chi_tiet.append({
                'thuoc': ct.thuoc.ten_thuoc,
                'so_luong': ct.so_luong,
                'don_gia': float(ct.thuoc.gia_ban),
                'thanh_tien': float(thanh_tien)
            })
        
        return Response({
            'toa_thuoc': toa_thuoc.ten_toa,
            'tong_tien': float(tong_tien),
            'chi_tiet': chi_tiet
        })

# ==================== DASHBOARD API ====================

class DashboardViewSet(viewsets.ViewSet):
    """API cho dashboard tổng quan"""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def thong_ke_tong_quan(self, request):
        """Thống kê tổng quan cho dashboard"""
        today = date.today()
        
        # Thống kê thuốc
        tong_thuoc = Thuoc.objects.filter(trang_thai=True).count()
        thuoc_sap_het_han = KhoThuoc.objects.filter(
            han_su_dung__lte=today + timedelta(days=90),
            han_su_dung__gt=today
        ).values('thuoc').distinct().count()
        
        # Thống kê vaccine
        tong_vaccine = Vaccine.objects.filter(trang_thai=True).count()
        vaccine_sap_het_han = KhoVaccine.objects.filter(
            han_su_dung__lte=today + timedelta(days=90),
            han_su_dung__gt=today
        ).values('vaccine').distinct().count()
        
        # Giá trị tồn kho
        gia_tri_ton_thuoc = KhoThuoc.objects.filter(
            han_su_dung__gt=today
        ).aggregate(
            tong=Sum(F('so_luong') * F('thuoc__don_gia_nhap'))
        )['tong'] or 0
        
        gia_tri_ton_vaccine = KhoVaccine.objects.filter(
            han_su_dung__gt=today
        ).aggregate(
            tong=Sum(F('so_luong') * F('vaccine__gia_nhap'))
        )['tong'] or 0
        
        # Nhập kho gần đây
        nhap_kho_gan_day = PhieuNhapKho.objects.order_by('-ngay_nhap')[:10]
        
        return Response({
            'thuoc': {
                'tong': tong_thuoc,
                'sap_het_han': thuoc_sap_het_han,
                'gia_tri_ton': gia_tri_ton_thuoc
            },
            'vaccine': {
                'tong': tong_vaccine,
                'sap_het_han': vaccine_sap_het_han,
                'gia_tri_ton': gia_tri_ton_vaccine
            },
            'nhap_kho_gan_day': PhieuNhapKhoSerializer(nhap_kho_gan_day, many=True).data
        })

    @action(detail=False, methods=['get'])
    def canh_bao_ton_kho(self, request):
        """Cảnh báo tồn kho (sắp hết, sắp hết hạn)"""
        today = date.today()
        ba_thang_toi = today + timedelta(days=90)
        
        # Thuốc sắp hết hạn
        thuoc_sap_het_han = KhoThuoc.objects.filter(
            han_su_dung__lte=ba_thang_toi,
            han_su_dung__gt=today,
            so_luong__gt=0
        ).select_related('thuoc').order_by('han_su_dung')
        
        # Thuốc sắp hết hàng (tồn < 10)
        thuoc_sap_het_hang = []
        for thuoc in Thuoc.objects.filter(trang_thai=True):
            ton = thuoc.ton_kho()
            if 0 < ton <= 10:
                thuoc_sap_het_hang.append({
                    'thuoc': thuoc.ten_thuoc,
                    'ton_kho': ton
                })
        
        # Vaccine sắp hết hạn
        vaccine_sap_het_han = KhoVaccine.objects.filter(
            han_su_dung__lte=ba_thang_toi,
            han_su_dung__gt=today,
            so_luong__gt=0
        ).select_related('vaccine').order_by('han_su_dung')

        vaccine_sap_het_hang = []
        for vc in Vaccine.objects.filter(trang_thai=True):
            ton = vc.ton_kho()
            if 0 < ton < 10:
                vaccine_sap_het_hang.append({
                    'vaccine': vc.ten_vaccine,
                    'ton_kho': ton
                })
        
        return Response({
            'thuoc_sap_het_han': KhoThuocSerializer(thuoc_sap_het_han, many=True).data,
            'thuoc_sap_het_hang': thuoc_sap_het_hang,
            'vaccine_sap_het_han': KhoVaccineSerializer(vaccine_sap_het_han, many=True).data,
            'vaccine_sap_het_hang': vaccine_sap_het_hang,
        })

    @action(detail=False, methods=['get'], url_path='ke-toan/tom-tat')
    def tom_tat_ke_toan(self, request):
        """
        Thống kê doanh thu & lợi nhuận (ước tính) cho kế toán.

        - Đơn hàng: HOAN_THANH hoặc DA_THANH_TOAN (đã thu tiền tại quầy / chờ giao).
        - Đơn thuốc toa: đã có doanh (da_thanh_toan hoặc trạng thái đã thanh toán/hoàn thành).
        - Vào kỳ nếu ngay_tao hoặc ngay_cap_nhat nằm trong [tu, den] (theo múi giờ TIME_ZONE).
        - Lọc thời gian bằng datetime có timezone (tránh lỗi MySQL + USE_TZ với __date/__year).
        - Giá vốn: Σ (SL × đơn giá nhập thuốc), NULL coi như 0.
        """
        if not (la_ke_toan(request.user) or la_admin_he_thong(request.user)):
            raise PermissionDenied('Chỉ kế toán hoặc quản trị viên được xem báo cáo tài chính.')
        from phongkham.time_utils import bounds_for_local_days
        from benhan.revenue_utils import don_thuoc_co_doanh_q
        from donhang.models import DonHang, ChiTietDonHang
        from benhan.models import DonThuoc, ChiTietDonThuoc, LichSuTiemChung

        tu = request.query_params.get('tu') or request.query_params.get('tu_ngay')
        den = request.query_params.get('den') or request.query_params.get('den_ngay')
        if not tu or not den:
            return Response(
                {'error': 'Cần tham số tu và den (định dạng YYYY-MM-DD)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            tu_d = datetime.strptime(str(tu)[:10], '%Y-%m-%d').date()
            den_d = datetime.strptime(str(den)[:10], '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'tu/den không đúng định dạng YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        start, end = bounds_for_local_days(tu_d, den_d)
        _tz = ZoneInfo(str(settings.TIME_ZONE))

        _dec_out = DecimalField(max_digits=22, decimal_places=2)
        _zero_dgn = Value(0, output_field=DecimalField(max_digits=12, decimal_places=2))

        # Đồng bộ với nghiệp vụ doanh thu thực tế:
        # đơn đã thu tiền hoặc đang ở các bước xử lý sau thanh toán
        # đều phải được tính vào doanh thu/giá vốn.
        _tt_doanh_hang = (
            DonHang.TrangThai.HOAN_THANH,
            DonHang.TrangThai.DA_THANH_TOAN,
            DonHang.TrangThai.DANG_CHUAN_BI,
            DonHang.TrangThai.DANG_GIAO,
        )
        qs_don_co_doanh = DonHang.objects.filter(trang_thai__in=_tt_doanh_hang).filter(
            Q(ngay_tao__gte=start, ngay_tao__lte=end)
            | Q(ngay_cap_nhat__gte=start, ngay_cap_nhat__lte=end)
        ).distinct()

        don_thuoc_qs = DonThuoc.objects.filter(don_thuoc_co_doanh_q()).filter(
            Q(ngay_tao__gte=start, ngay_tao__lte=end)
            | Q(ngay_cap_nhat__gte=start, ngay_cap_nhat__lte=end)
        ).distinct()

        tiem_qs = LichSuTiemChung.objects.filter(
            trang_thai='DA_TIEM',
            ngay_tiem__gte=tu_d,
            ngay_tiem__lte=den_d,
        )

        doanh_thu_don_hang = float(qs_don_co_doanh.aggregate(s=Sum('tong_tien'))['s'] or 0)
        doanh_thu_don_thuoc = float(don_thuoc_qs.aggregate(s=Sum('tong_tien'))['s'] or 0)
        doanh_thu_tiem = float(
            tiem_qs.aggregate(
                s=Sum(Coalesce(F('vaccine__gia_tiem'), _zero_dgn), output_field=_dec_out)
            )['s']
            or 0
        )
        doanh_thu = doanh_thu_don_hang + doanh_thu_don_thuoc + doanh_thu_tiem

        gv_dh = ChiTietDonHang.objects.filter(don_hang__in=qs_don_co_doanh).aggregate(
            s=Sum(
                F('so_luong') * Coalesce(F('thuoc__don_gia_nhap'), _zero_dgn),
                output_field=_dec_out,
            )
        )['s'] or 0

        gv_dt = ChiTietDonThuoc.objects.filter(
            don_thuoc__in=don_thuoc_qs,
            la_thuoc_mua_ngoai=False,
            thuoc__isnull=False,
        ).aggregate(
            s=Sum(
                F('so_luong') * Coalesce(F('thuoc__don_gia_nhap'), _zero_dgn),
                output_field=_dec_out,
            )
        )['s'] or 0

        gia_von = float(gv_dh) + float(gv_dt)
        loi_nhuan = doanh_thu - gia_von

        phieu_cho_duyet = PhieuNhapKho.objects.filter(da_duyet_chi=False).count()

        # Theo ngày (theo lịch VN): TruncDate có tzinfo
        dh_rows = (
            qs_don_co_doanh.annotate(
                ngay_key=TruncDate(
                    Coalesce(F('ngay_cap_nhat'), F('ngay_tao')),
                    tzinfo=_tz,
                )
            )
            .values('ngay_key')
            .annotate(tien=Sum('tong_tien'))
        )
        dh_ngay = {row['ngay_key']: float(row['tien'] or 0) for row in dh_rows if row['ngay_key']}

        dt_rows = (
            don_thuoc_qs.annotate(
                ngay_key=TruncDate(
                    Coalesce(F('ngay_cap_nhat'), F('ngay_thanh_toan'), F('ngay_tao')),
                    tzinfo=_tz,
                )
            )
            .values('ngay_key')
            .annotate(tien=Sum('tong_tien'))
        )
        dt_ngay = {row['ngay_key']: float(row['tien'] or 0) for row in dt_rows if row['ngay_key']}

        tc_rows = (
            tiem_qs.values('ngay_tiem')
            .annotate(
                tien=Sum(
                    Coalesce(F('vaccine__gia_tiem'), _zero_dgn),
                    output_field=_dec_out,
                )
            )
        )
        tc_ngay = {row['ngay_tiem']: float(row['tien'] or 0) for row in tc_rows if row['ngay_tiem']}

        all_days = sorted(set(dh_ngay) | set(dt_ngay) | set(tc_ngay))
        theo_ngay = []
        max_tong = 0.0
        for day in all_days:
            a = dh_ngay.get(day, 0.0)
            b = dt_ngay.get(day, 0.0)
            c = tc_ngay.get(day, 0.0)
            tong = a + b + c
            max_tong = max(max_tong, tong)
            theo_ngay.append(
                {
                    'ngay': str(day) if day else '',
                    'doanh_thu_don_hang': a,
                    'doanh_thu_don_thuoc': b,
                    'doanh_thu_tiem': c,
                    'tong_doanh_thu': tong,
                }
            )

        # Top thuốc theo doanh thu (đơn hàng e-commerce / quầy)
        top_thuoc_don_hang = list(
            ChiTietDonHang.objects.filter(don_hang__in=qs_don_co_doanh)
            .values('thuoc__id', 'thuoc__ten_thuoc')
            .annotate(
                so_luong_ban=Sum('so_luong'),
                doanh_thu=Sum(F('don_gia') * F('so_luong') - F('chiet_khau'), output_field=_dec_out),
            )
            .order_by('-doanh_thu')[:10]
        )

        _zero_dec = Value(0, output_field=DecimalField(max_digits=12, decimal_places=2))
        # Top thuốc theo toa (đơn thuốc hoàn thành)
        top_thuoc_toa = list(
            ChiTietDonThuoc.objects.filter(
                don_thuoc__in=don_thuoc_qs,
                la_thuoc_mua_ngoai=False,
                thuoc__isnull=False,
            )
            .values('thuoc__id', 'thuoc__ten_thuoc')
            .annotate(
                so_luong_ban=Sum('so_luong'),
                doanh_thu=Sum(
                    Coalesce(F('don_gia_tai_thoi_diem'), _zero_dec) * F('so_luong'),
                    output_field=_dec_out,
                ),
            )
            .order_by('-doanh_thu')[:10]
        )

        return Response(
            {
                'tu': tu,
                'den': den,
                'doanh_thu': doanh_thu,
                'doanh_thu_don_hang': doanh_thu_don_hang,
                'doanh_thu_don_thuoc': doanh_thu_don_thuoc,
                'doanh_thu_tiem': doanh_thu_tiem,
                'gia_von_uoc_tinh': gia_von,
                'gia_von_don_hang': float(gv_dh),
                'gia_von_don_thuoc': float(gv_dt),
                'loi_nhuan_uoc_tinh': loi_nhuan,
                'so_don_hang': qs_don_co_doanh.count(),
                'so_don_thuoc': don_thuoc_qs.count(),
                'so_lan_tiem': tiem_qs.count(),
                'so_giao_dich': qs_don_co_doanh.count() + don_thuoc_qs.count() + tiem_qs.count(),
                'theo_ngay': theo_ngay,
                'bieu_do_max': max_tong,
                'top_thuoc_don_hang': [
                    {
                        'ten_thuoc': x.get('thuoc__ten_thuoc') or '',
                        'so_luong': x.get('so_luong_ban') or 0,
                        'doanh_thu': float(x.get('doanh_thu') or 0),
                    }
                    for x in top_thuoc_don_hang
                ],
                'top_thuoc_theo_toa': [
                    {
                        'ten_thuoc': x.get('thuoc__ten_thuoc') or '',
                        'so_luong': x.get('so_luong_ban') or 0,
                        'doanh_thu': float(x.get('doanh_thu') or 0),
                    }
                    for x in top_thuoc_toa
                ],
                'phieu_nhap_cho_duyet_chi': phieu_cho_duyet,
                'tieu_chi_doanh_thu': 'HOAN_THANH_DA_THANH_TOAN + DON_THUOC_CO_DOANH + TIEM_CHUNG_DA_TIEM',
                'ghi_chu': (
                    'Đơn hàng: Hoàn thành hoặc Đã thanh toán (đã thu). '
                    'Đơn thuốc toa: đã thanh toán / hoàn thành (theo cờ và trạng thái). '
                    'Tiêm chủng: các mũi đã tiêm (DA_TIEM), lấy giá theo bảng giá vaccine hiện tại. '
                    'Vào kỳ nếu ngày tạo hoặc ngày cập nhật cuối nằm trong khoảng (theo giờ hệ thống).'
                ),
            }
        )