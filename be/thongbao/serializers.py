from rest_framework import serializers
from .models import ThongBao

class ThongBaoSerializer(serializers.ModelSerializer):
    loai_thong_bao_display = serializers.CharField(source='get_loai_thong_bao_display', read_only=True)
    
    class Meta:
        model = ThongBao
        fields = ['id', 'loai_thong_bao', 'loai_thong_bao_display', 'tieu_de', 
                 'noi_dung', 'da_doc', 'ngay_tao', 'lien_ket']
        read_only_fields = ['id', 'ngay_tao']

class TaoThongBaoSerializer(serializers.Serializer):
    """Serializer để tạo thông báo thủ công"""
    nguoi_nhan_id = serializers.UUIDField()
    loai_thong_bao = serializers.ChoiceField(choices=ThongBao.LOAI_THONG_BAO_CHOICES)
    tieu_de = serializers.CharField(max_length=255)
    noi_dung = serializers.CharField()
    lien_ket = serializers.CharField(required=False, allow_blank=True)
    
    def create(self, validated_data):
        from nguoidung.models import NguoiDung
        
        nguoi_nhan = NguoiDung.objects.get(id=validated_data['nguoi_nhan_id'])
        
        return ThongBao.tao_thong_bao(
            nguoi_nhan=nguoi_nhan,
            loai=validated_data['loai_thong_bao'],
            tieu_de=validated_data['tieu_de'],
            noi_dung=validated_data['noi_dung'],
            lien_ket=validated_data.get('lien_ket', '')
        )