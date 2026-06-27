
const nodemailer = require('nodemailer');
const { SocksProxyAgent } = require('socks-proxy-agent');

// HELPER ENGINE: Handles randomized generation tasks for characters
function runCryptoStringGen(len, upper, lower, num) {
  let pool = "";
  if (upper) pool += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (lower) pool += "abcdefghijklmnopqrstuvwxyz";
  if (num) pool += "0123456789";
  if (!pool) return "";
  
  let out = "";
  for (let i = 0; i < len; i++) {
    out += pool.charAt(Math.floor(Math.random() * pool.length));
  }
  return out;
}

// CENTRAL CONVERSION STRIPPER
function processDynamicTags(inputStr, customConfig = []) {
  if (!inputStr || typeof inputStr !== 'string') return inputStr;
  
  let content = inputStr;

  // 1. PROCESS THE TOP 20 INVENTORY DEFAULTS
  content = content.replace(/\$word4/g, () => runCryptoStringGen(4, true, false, false));
  content = content.replace(/\$word6/g, () => runCryptoStringGen(6, false, true, false));
  content = content.replace(/\$mix5/g, () => runCryptoStringGen(5, true, true, false));
  content = content.replace(/\$string10/g, () => runCryptoStringGen(10, true, false, false));
  
  content = content.replace(/\$num4/g, () => runCryptoStringGen(4, false, false, true));
  content = content.replace(/\$num6/g, () => runCryptoStringGen(6, false, false, true));
  content = content.replace(/\$num9/g, () => runCryptoStringGen(9, false, false, true));
  content = content.replace(/\$amount/g, () => (45 + Math.random() * 110).toFixed(2));
  
  content = content.replace(/\$random6/g, () => runCryptoStringGen(6, true, true, true));
  content = content.replace(/\$random8/g, () => runCryptoStringGen(8, true, false, true));
  content = content.replace(/\$random12/g, () => runCryptoStringGen(12, false, true, true));
  
  content = content.replace(/\$uuid/g, () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  });

  content = content.replace(/\$date/g, () => new Date().toISOString().split('T')[0]);
  content = content.replace(/\$timestamp/g, () => Math.floor(Date.now() / 1000).toString());
  content = content.replace(/\$time/g, () => new Date().toTimeString().split(' ')[0].substring(0, 5));
  content = content.replace(/\$year/g, "2026");

  content = content.replace(/\$os/g, () => {
    const arr = ["Windows 10", "Windows 11", "MacOS Sonoma", "Ubuntu Linux", "iOS 17", "Android 14"];
    return arr[Math.floor(Math.random() * arr.length)];
  });
  content = content.replace(/\$browser/g, () => {
    const arr = ["Chrome/125.0.0", "Safari/17.4", "Firefox/124.0", "Edge/123.0"];
    return arr[Math.floor(Math.random() * arr.length)];
  });
  content = content.replace(/\$country/g, () => {
    const arr = ["United States", "Canada", "United Kingdom", "Australia", "Germany", "France"];
    return arr[Math.floor(Math.random() * arr.length)];
  });
  content = content.replace(/\$rs/g, () => {
    const arr = ["Re: ", "Status: ", "Alert - ", "Notice: ", "Update - ", ""];
    return arr[Math.floor(Math.random() * arr.length)];
  });

  // 2. LOOP AND PROCESS CUSTOM DYNAMICALLY CONSTRUCTED USER MACROS
  if (Array.isArray(customConfig)) {
    customConfig.forEach(tag => {
      // Create global regex safety escape for the word literal ($customName)
      const escapeRegex = new RegExp(`\\$${tag.name}`, 'g');
      content = content.replace(escapeRegex, () => {
        return runCryptoStringGen(parseInt(tag.len), tag.upper, tag.lower, tag.num);
      });
    });
  }

  return content;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { smtpConfig, mailData, customTagsConfig } = req.body;

  const mHost = process.env.MASTER_PROXY_HOST;
  const mPort = process.env.MASTER_PROXY_PORT;
  const mUser = process.env.MASTER_PROXY_USER;
  const mPass = process.env.MASTER_PROXY_PASS;

  let agent = null;
  if (mHost && mPort) {
    const proxyAuth = (mUser && mPass) ? `${mUser}:${mPass}@` : '';
    agent = new SocksProxyAgent(`socks5h://${proxyAuth}${mHost}:${mPort}`);
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port),
    secure: parseInt(smtpConfig.port) === 465, 
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    pool: false, 
    timeout: 15000, 
    connectionTimeout: 15000,
    ...(agent && { agent }) 
  });

  // RUN DYNAMIC PROCESSOR ACROSS ALL TEXT INJECTION SURFACES BEFORE DELIVERY HANDSHAKE
  const readyFromName = processDynamicTags(mailData.fromName, customTagsConfig);
  const readySubject  = processDynamicTags(mailData.subject, customTagsConfig);
  const readyHtml     = processDynamicTags(mailData.html, customTagsConfig);

  try {
    const info = await transporter.sendMail({
      from: `"${readyFromName}" <${smtpConfig.user}>`,
      to: mailData.to,
      subject: readySubject,
      html: readyHtml
    });

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
