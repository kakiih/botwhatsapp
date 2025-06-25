const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode-terminal");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    version: (await fetchLatestBaileysVersion()).version,
    auth: state,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\n📷 ESCANEIE O QR CODE ABAIXO COM SEU WHATSAPP:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("Conexão encerrada. Reconectando?", shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("✅ Bot conectado com sucesso!");
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation || msg.message.extendedTextMessage?.text;

    console.log("📩 Mensagem recebida:", text);
    const prefixo = "$";
    if (text?.startsWith(prefixo)) {
      const comando = text.slice(1).trim().toLowerCase();

      switch (comando) {
        case "ping":
          await sock.sendMessage(from, { text: "Pong!" });
          break;
        case "menu":
          await sock.sendMessage(from, {
            text: `
╭━━━❰  ༆꙳ *BOT DA SYLVA* ࿐  ❱━━━╮
┃
┃ 🤖 *Comandos disponíveis:*
┃
┃ 📡 ${prefixo}ping — Testa se o bot tá vivo
┃ 🕒 ${prefixo}hora — Mostra o horário atual
┃ 📜 ${prefixo}menu — Exibe este menu
┃ 🍽️ ${prefixo}comer @ — Coma alguém do grupo!
┃ 💋 ${prefixo}beijar @ — Beije alguém com carinho
┃ ✋ ${prefixo}tapa @ — Dê um tapa com estilo!
┃ 🚽 ${prefixo}mijar @ — Liberte a bexiga em alguém
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
    `,
          });
          break;

        case "hora":
          const hora = new Date().toLocaleTimeString();
          await sock.sendMessage(from, { text: `Agora são: ${hora}` });
          break;
        case "beijar":
          if (
            !msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length
          ) {
            await sock.sendMessage(from, {
              text: "❗ Mencione alguém para beijar!",
            });
            break;
          }
          const mencionadoBeijar =
            msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
          await sock.sendMessage(from, {
            text: `💋 Você acaba de receber um beijo estalado!`,
            mentions: [mencionadoBeijar],
          });
          break;

        case "comer":
          if (
            !msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length
          ) {
            await sock.sendMessage(from, {
              text: "❗ Mencione alguém para comer!",
            });
            break;
          }
          const mencionadoComer =
            msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
          await sock.sendMessage(from, {
            text: `🍽️ @${
              mencionadoComer.split("@")[0]
            } foi comido(a) com gosto! 😏`,
            mentions: [mencionadoComer],
          });
          break;
        case "tapa":
          await sock.sendMessage(from, { text: "Pong!" });
          break;
        case "tapa":
          if (
            !msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length
          ) {
            await sock.sendMessage(from, {
              text: `❗ Mencione alguém para dar um tapa!`,
            });
            break;
          }
          const mencionadoTapa =
            msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
          await sock.sendMessage(from, {
            text: `🖐️ @${
              mencionadoTapa.split("@")[0]
            } tomou um belo tapão na cara! Vai deixar? 😮`,
            mentions: [mencionadoTapa],
          });
          break;

        case "mijar":
          if (
            !msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length
          ) {
            await sock.sendMessage(from, {
              text: `❗ Mencione alguém para mijar!`,
            });
            break;
          }
          const mencionadoMijar =
            msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
          await sock.sendMessage(from, {
            text: `🖐️ @${
              mencionadoMijar.split("@")[0]
            } tomou uma mijada na cara! Vai deixar? 😮`,
            mentions: [mencionadoMijar],
          });
          break;
        default:
          await sock.sendMessage(from, {
            text: "❓ Comando não reconhecido. Digite `$ajuda` para ver os comandos.",
          });
      }
    }
  });
}

startBot();
