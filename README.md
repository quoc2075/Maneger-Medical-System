# Manager Medical System (Phong kham)

He thong quan ly phong kham y te: backend Django REST + frontend HTML/JS, ho tro nhieu vai tro (admin, bac si, le tan, benh nhan, kho, ke toan, ban thuoc).

## Cau truc

- `be/` — Django API (MySQL, JWT, Channels)
- `fe/` — Giao dien web theo vai tro
- `requirements.txt` — Python dependencies
- `DEPLOY_LAN.md` — Huong dan trien khai tren mang LAN

## Cai dat nhanh

1. Tao virtualenv va cai dependencies:
   ```bash
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. Sao chep `be/.env.example` thanh `be/.env` va cau hinh MySQL.
3. Tu thu muc `be`:
   ```bash
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver
   ```
4. Mo trinh duyet: `http://127.0.0.1:8000`

Chi tiet trien khai LAN: xem [DEPLOY_LAN.md](DEPLOY_LAN.md).
