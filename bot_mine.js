const mineflayer = require('mineflayer');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ==========================================
// 1. CẤU HÌNH CỦA BẠN (SỬA CÁC DÒNG NÀY)
// ==========================================
const SERVER_HOST = 'play.kingmc.vn';      // IP server game
const SERVER_PORT = 25565;            // Port server game
const BOT_USERNAME = 'pumtrummod';     // Tên acc Minecraft của bot
const BOT_VERSION = '1.21.1';         // Phiên bản server (thử 1.20.1 hoặc false)
const PASSWORD = 'manhne11';   // Mật khẩu acc Minecraft

// ĐỊA CHỈ API CỦA BOT DISCORD (QUAN TRỌNG)
// Bạn phải thay IP_HOST_CLOUDCODE bằng IP thật của host đang chạy botmoi.py
// Ví dụ: http://103.145.10.20:24950/api/game_payment
const DISCORD_API_URL = "http://IP_HOST_CLOUDCODE_CUA_BAN:24950/api/game_payment";

// ==========================================
// 2. KHỞI TẠO & KẾT NỐI
// ==========================================
let globalBot = null; 
let isInMainServer = false;
let joinAttempt = 0; 
let hasLoggedIn = false; 

function startBot() {
  joinAttempt++;
  hasLoggedIn = false; 
  console.log(`\n🔄 [LẦN ${joinAttempt}] Đang kết nối vào server...`);
  
  const bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: BOT_USERNAME,
    version: BOT_VERSION,
    hideErrors: true,               // Bỏ qua lỗi gói tin rác từ server
    checkTimeoutInterval: 120000    // Tăng thời gian timeout
  });
  
  globalBot = bot; 

  // Bắt lỗi mạng để bot không bị crash
  bot.on('error', (err) => { 
    if (err.code !== 'ECONNRESET') console.log(`[LỖI] ${err.message}`); 
  });

  // Xử lý khi bot vào sảnh chờ
  bot.on('spawn', () => {
    console.log(`✅ [LẦN ${joinAttempt}] Đã vào sảnh chờ!`);
    
    if (joinAttempt === 1) {
      // Lần đầu: Bị chặn bởi Anti-Bot, tự động out sau 3s để vào lại
      console.log(`⏳ [CHỐNG BOT] Tự động out sau 3 giây...`);
      setTimeout(() => { bot.quit(); }, 3000); 
    } else {
      // Lần 2: Đã qua Anti-Bot, tiến hành đăng nhập
      if (hasLoggedIn) return; 
      hasLoggedIn = true;
      
      setTimeout(() => { 
        console.log(`[AUTH] Đang gửi lệnh đăng nhập...`);
        bot.chat(`/dn ${PASSWORD}`); 
      }, 2000);

      setTimeout(() => { 
        if (!isInMainServer) {
          console.log(`[GUI] Đang chọn ô đồng hồ (ô thứ 5) để mở Menu...`);
          bot.setQuickBarSlot(4); 
          bot.activateItem(); 
        }
      }, 6000);
    }
  });

  // Xử lý khi Menu hiện ra -> Click vào server chính
  bot.on('windowOpen', (window) => {
    let titleStr = "";
    try {
      if (typeof window.title === 'string') titleStr = window.title;
      else titleStr = JSON.stringify(window.title);
    } catch (e) { titleStr = "Unknown"; }
    
    console.log(`[GUI] Đã mở bảng: ${titleStr}`);
    
    if (!isInMainServer) {
      setTimeout(() => { 
        console.log(`[GUI] Đang click ô 25 để vào KingSMP...`);
        bot.clickWindow(24, 0, 0); 
        isInMainServer = true; 
      }, 1000);
    }
  });

  // ĐỌC TIN NHẮN CHAT ĐỂ BẮT KHI CÓ TIỀN VÀO
  bot.on('message', async (jsonMsg) => {
    const msg = jsonMsg.toString();
    
    // Nếu thấy tin nhắn báo nhận tiền (tùy server, có thể là "Bạn nhận được...")
    if (msg.includes("Bạn nhận được") && msg.includes("từ")) {
        console.log(`[TIỀN VÀO] ${msg}`);
        // Gửi thông tin về cho Bot Discord
        try { 
            await axios.post(DISCORD_API_URL, { message: msg }); 
            console.log(`[API] Đã gửi thông tin về Discord thành công.`);
        } catch (error) { 
            console.log(`❌ [API LỖI] ${error.message}`); 
        }
    }
  });

  // Tự động kết nối lại nếu bị rớt mạng
  bot.on('end', (reason) => {
    console.log(`❌ Bot ngắt kết nối. Lý do: ${reason}`);
    if (joinAttempt === 1 || !isInMainServer) {
      console.log(`🔄 Tự động kết nối lại sau 3 giây...`);
      setTimeout(startBot, 3000); 
    }
  });
  
  // Chống AFK: Tự động nhảy mỗi 30 giây
  setInterval(() => { 
    if (isInMainServer && bot.entity) { 
      bot.setControlState('jump', true); 
      setTimeout(() => bot.setControlState('jump', false), 500); 
    } 
  }, 30000);
}

// Khởi chạy bot
startBot();

// ==========================================
// 3. API ĐỂ BOT DISCORD GỌI SANG TRẢ TIỀN (RÚT)
// ==========================================
app.post('/pay', (req, res) => {
  const { ign, amount } = req.body;
  
  if (!isInMainServer || !globalBot) {
      console.log(`[PAY LỖI] Bot chưa vào server chính.`);
      return res.status(400).send({ status: 'error', message: 'Bot chưa vào server' });
  }
  
  // Gõ lệnh trả tiền trong game
  globalBot.chat(`/pay ${ign} ${amount}`);
  console.log(`[PAY] Đã gõ lệnh: /pay ${ign} ${amount}`);
  res.send({ status: 'success' });
});

// Mở cổng API (Render sẽ tự động gán cổng, không cần sửa)
app.listen(process.env.PORT || 3000, () => { 
  console.log('🌐 API Bot Mine đang chạy ở cổng 3000'); 
});
