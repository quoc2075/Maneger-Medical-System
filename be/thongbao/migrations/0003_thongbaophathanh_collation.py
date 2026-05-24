# Khớp collation utf8mb4_unicode_ci (MariaDB 10.4)

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('thongbao', '0002_thongbaophathanh'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                'ALTER TABLE thong_bao_phat_hanh '
                'CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
