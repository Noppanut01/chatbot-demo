# LINE OA Chatbot Demo

Webhook แบบง่ายที่สุด: รับข้อความจาก LINE OA แล้วตอบกลับด้วย mock response (ยังไม่ต่อ RAG จริง — จุดที่จะต่อคือฟังก์ชัน `getReplyText` ใน `server.js`)

## ติดตั้ง

```bash
npm install
cp .env.example .env
```

## ตั้งค่า LINE

1. เข้า https://developers.line.biz > สร้าง Provider + Messaging API channel (ฟรี)
2. หน้า channel > คัดลอก **Channel secret** และออก **Channel access token** (long-lived) ใส่ใน `.env`
3. ปิด "Auto-reply messages" และ "Greeting messages" ในหน้า LINE Official Account Manager เพื่อไม่ให้ชนกับ bot ของเรา

## รันเซิร์ฟเวอร์ + เปิด tunnel

```bash
npm run dev
```

เปิดอีก terminal เพื่อ tunnel ให้ LINE ยิง webhook เข้ามาที่เครื่องเราได้:

```bash
ngrok http 3000
```

เอา URL ที่ได้ (เช่น `https://xxxx.ngrok-free.app`) ไปตั้งใน Messaging API channel > Webhook URL เป็น `https://xxxx.ngrok-free.app/webhook` แล้วกด Verify + เปิด "Use webhook"

## ทดสอบ

แอด bot เป็นเพื่อนผ่าน QR code ในหน้า channel แล้วพิมพ์ข้อความคุยได้เลย
