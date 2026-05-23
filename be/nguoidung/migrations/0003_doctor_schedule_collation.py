# Khớp collation với bảng bac_si / nguoi_dung (tránh lỗi 1267 khi JOIN)

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('nguoidung', '0002_doctor_schedule'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                'ALTER TABLE doctor_schedule '
                'CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
