const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")
const { Boom } = require("@hapi/boom")
const qrcode = require("qrcode-terminal")

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth")

    const sock = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        auth: state
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log("\n📷 ESCANEIE O QR CODE ABAIXO COM SEU WHATSAPP:\n")
            qrcode.generate(qr, { small: true })
        }

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut
            console.log("Conexão encerrada. Reconectando?", shouldReconnect)
            if (shouldReconnect) startBot()
        } else if (connection === "open") {
            console.log("✅ Bot conectado com sucesso!")
        }
    })

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return

        const from = msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text

        console.log("📩 Mensagem recebida:", text)

        if (text?.toLowerCase() === "ping") {
            await sock.sendMessage(from, { text: "pong" })
            console.log("🔁 Resposta enviada: pong")
        }
    })
}

startBot()

