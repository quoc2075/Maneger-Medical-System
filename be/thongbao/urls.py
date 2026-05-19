from django.urls import path
from .views import (
    BaoCaoDoanhThuView, BaoCaoLichHenView, 
    BaoCaoTonKhoView, BaoCaoTongQuanView
)

urlpatterns = [
    path('doanh-thu/', BaoCaoDoanhThuView.as_view(), name='bao-cao-doanh-thu'),
    path('lich-hen/', BaoCaoLichHenView.as_view(), name='bao-cao-lich-hen'),
    path('ton-kho/', BaoCaoTonKhoView.as_view(), name='bao-cao-ton-kho'),
    path('tong-quan/', BaoCaoTongQuanView.as_view(), name='bao-cao-tong-quan'),
]