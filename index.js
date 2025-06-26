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
  const prefixo = ",";

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

  // Mapa para armazenar desafios pendentes:
  // chave = usuário desafiado (jid), valor = usuário que desafiou (jid)
  const desafios = new Map();

  // Estado do jogo da velha ativo (null = nenhum jogo em andamento)
  let jogoAtivo = null;
  // estrutura: { jogadores: [jidX, jidO], tabuleiro: [], turno: 0 ou 1 }

  const simbolos = { X: "❌", O: "⭕" };
  const emojisNumeros = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];

  // Função para mostrar tabuleiro formatado
  function mostrarTabuleiro(tab) {
    return tab
      .map((c, i) => c)
      .reduce((acc, cur, idx) => {
        acc += cur;
        if ((idx + 1) % 3 === 0) acc += "\n";
        return acc;
      }, "");
  }

  // Verifica se posição é válida e não ocupada
  function posicaoValida(pos, tab) {
    return (
      pos >= 1 && pos <= 9 && ![simbolos.X, simbolos.O].includes(tab[pos - 1])
    );
  }

  // Checa vitória no tabuleiro para um símbolo
  function checkWin(tab, simbolo) {
    const linhasVitoria = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8], // linhas
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8], // colunas
      [0, 4, 8],
      [2, 4, 6], // diagonais
    ];
    return linhasVitoria.some((line) => line.every((i) => tab[i] === simbolo));
  }

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    console.log("📩 Mensagem recebida:", text);

    const textoMinusculo = text.toLowerCase();

    if (text.startsWith(prefixo)) {
      // Separa comando e argumentos
      const args = text.slice(1).trim().split(/\s+/);
      const comando = args[0].toLowerCase();

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
┃ 🎮 ${prefixo}jogodavelha @ — Desafie alguém para jogar!
┃ 🎲 ${prefixo}jokenpo — [pedra, papel ou tesoura]
┃ 🖼️ ${prefixo}s — crie um sticker!
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
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
          {
            const mencionadoBeijar =
              msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            await sock.sendMessage(from, {
              text: `💋 Você acaba de receber um beijo estalado!`,
              mentions: [mencionadoBeijar],
            });
          }
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
          {
            const mencionadoComer =
              msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            await sock.sendMessage(from, {
              text: `🍽️ @${
                mencionadoComer.split("@")[0]
              } foi comido(a) com gosto! 😏`,
              mentions: [mencionadoComer],
            });
          }
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
          {
            const mencionadoTapa =
              msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            await sock.sendMessage(from, {
              text: `🖐️ @${
                mencionadoTapa.split("@")[0]
              } tomou um belo tapão na cara! Vai deixar? 😮`,
              mentions: [mencionadoTapa],
            });
          }
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
          {
            const mencionadoMijar =
              msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            await sock.sendMessage(from, {
              text: `🖐️ @${
                mencionadoMijar.split("@")[0]
              } tomou uma mijada na cara! Vai deixar? 😮`,
              mentions: [mencionadoMijar],
            });
          }
          break;

        case "jogodavelha":
          if (
            !msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length
          ) {
            await sock.sendMessage(from, {
              text: `❗ Mencione alguém para jogar!`,
            });
            break;
          }
          {
            const desafiado =
              msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            const desafiador = msg.key.participant || msg.key.remoteJid;

            if (desafiado === desafiador) {
              await sock.sendMessage(from, {
                text: "❗ Você não pode se desafiar.",
              });
              break;
            }

            if (jogoAtivo) {
              await sock.sendMessage(from, {
                text: "⚠️ Já existe um jogo ativo. Aguarde ele terminar.",
              });
              break;
            }

            desafios.set(desafiado, desafiador);

            await sock.sendMessage(from, {
              text: `Ei @${desafiado.split("@")[0]}, o @${
                desafiador.split("@")[0]
              } quer jogar com você! Responda Sim ou Não.`,
              mentions: [desafiado, desafiador],
            });
          }
          break;

        case "jokenpo":
          const jokenpo = ["pedra", "papel", "tesoura"];
          const escolhausuario = args.slice(1).join(" ").toLowerCase();
          const itemSorteado =
            jokenpo[Math.floor(Math.random() * jokenpo.length)];

          if (jokenpo.includes(escolhausuario)) {
            if (escolhausuario === itemSorteado) {
              await sock.sendMessage(from, {
                text: `🤝 Empate! Ambos escolheram *${itemSorteado}*.`,
              });
            } else if (
              (escolhausuario === "pedra" && itemSorteado === "tesoura") ||
              (escolhausuario === "papel" && itemSorteado === "pedra") ||
              (escolhausuario === "tesoura" && itemSorteado === "papel")
            ) {
              await sock.sendMessage(from, {
                text: `🎉 Você venceu! Você escolheu *${escolhausuario}* e o bot escolheu *${itemSorteado}*.`,
              });
            } else {
              await sock.sendMessage(from, {
                text: `💀 Você perdeu! Você escolheu *${escolhausuario}* e o bot escolheu *${itemSorteado}*.`,
              });
            }
          } else {
            await sock.sendMessage(from, {
              text: `❗ Escolha inválida! Use: pedra, papel ou tesoura.`,
            });
          }
          break;

        default:
          await sock.sendMessage(from, {
            text: `❓ Comando não reconhecido. Digite ${prefixo}menu para ver os comandos.`,
          });
      }
    } else {
      // Mensagens sem prefixo (provável resposta a desafio ou jogada)
      const autorMsg = msg.key.participant || msg.key.remoteJid;

      if (desafios.has(autorMsg)) {
        // Resposta ao desafio
        const desafiador = desafios.get(autorMsg);

        if (textoMinusculo === "sim") {
          if (jogoAtivo) {
            await sock.sendMessage(from, {
              text: "⚠️ Já existe um jogo ativo. Aguarde ele terminar.",
            });
            desafios.delete(autorMsg);
            return;
          }

          jogoAtivo = {
            jogadores: [desafiador, autorMsg], // desafiador = X começa
            tabuleiro: [...emojisNumeros],
            turno: 0,
          };

          desafios.delete(autorMsg);

          await sock.sendMessage(from, {
            text: `🎮 Jogo da velha iniciado!\n@${
              jogoAtivo.jogadores[0].split("@")[0]
            } (❌) começa jogando.\n@${
              jogoAtivo.jogadores[1].split("@")[0]
            } (⭕) é o adversário.\n\n${mostrarTabuleiro(
              jogoAtivo.tabuleiro
            )}\n\nEnvie um número de 1 a 9 para fazer sua jogada.`,
            mentions: jogoAtivo.jogadores,
          });
        } else if (textoMinusculo === "não" || textoMinusculo === "nao") {
          await sock.sendMessage(from, {
            text: `@${autorMsg.split("@")[0]} recusou o desafio.`,
            mentions: [autorMsg],
          });
          desafios.delete(autorMsg);
        }
        return;
      }

      // Se jogo ativo, trata jogadas
      if (jogoAtivo && jogoAtivo.jogadores.includes(autorMsg)) {
        const jogadorAtual = jogoAtivo.jogadores[jogoAtivo.turno];
        if (autorMsg !== jogadorAtual) {
          await sock.sendMessage(from, {
            text: "⏳ Não é seu turno ainda, aguarde sua vez.",
          });
          return;
        }

        const posJogada = parseInt(text);
        if (!posicaoValida(posJogada, jogoAtivo.tabuleiro)) {
          await sock.sendMessage(from, {
            text: "❗ Posição inválida ou já ocupada. Envie um número de 1 a 9 correspondente a uma casa vazia.",
          });
          return;
        }

        const simboloAtual = jogoAtivo.turno === 0 ? simbolos.X : simbolos.O;
        jogoAtivo.tabuleiro[posJogada - 1] = simboloAtual;

        // Converter para "X" e "O" para facilitar verificação de vitória
        const tab = jogoAtivo.tabuleiro.map((c) => {
          if (c === simbolos.X) return "X";
          if (c === simbolos.O) return "O";
          return " ";
        });

        // Verifica vitória
        if (checkWin(tab, simboloAtual === simbolos.X ? "X" : "O")) {
          await sock.sendMessage(from, {
            text: `🎉 Parabéns @${
              autorMsg.split("@")[0]
            }, você venceu!\n\n${mostrarTabuleiro(jogoAtivo.tabuleiro)}`,
            mentions: [autorMsg],
          });
          jogoAtivo = null;
          return;
        }

        // Verifica empate
        if (
          jogoAtivo.tabuleiro.every((c) => c === simbolos.X || c === simbolos.O)
        ) {
          await sock.sendMessage(from, {
            text: `🤝 Empate! O jogo acabou.\n\n${mostrarTabuleiro(
              jogoAtivo.tabuleiro
            )}`,
          });
          jogoAtivo = null;
          return;
        }

        // Troca turno
        jogoAtivo.turno = 1 - jogoAtivo.turno;

        await sock.sendMessage(from, {
          text: `Jogada registrada!\n\n${mostrarTabuleiro(
            jogoAtivo.tabuleiro
          )}\n\nÉ a vez de @${
            jogoAtivo.jogadores[jogoAtivo.turno].split("@")[0]
          }.`,
          mentions: jogoAtivo.jogadores,
        });
      }
    }
  });
}

startBot();
