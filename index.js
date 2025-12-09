import pkg from '@whiskeysockets/baileys'
import fs from 'fs'

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = pkg

// Cargar datos
let catalog = JSON.parse(fs.readFileSync('./catalog.json'))
let orders = JSON.parse(fs.readFileSync('./orders.json'))
let codes = JSON.parse(fs.readFileSync('./codes.json'))
let carts = JSON.parse(fs.readFileSync('./carts.json'))

let allowedUsers = []

async function connectBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth')
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({ version, auth: state, printQRInTerminal: true })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return

        const sender = m.key.remoteJid
        const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim().toLowerCase()

        // ---------- ACCESO POR CÓDIGO ----------
        if (!allowedUsers.includes(sender)) {
            if (text.length === 8 && codes.includes(text)) {
                allowedUsers.push(sender)
                await sock.sendMessage(sender, { text: '✔ Código aceptado, ahora puedes usar el bot.\nEscribe *menu* para comenzar.' })
            } else {
                await sock.sendMessage(sender, { text: '❌ Ingresa tu código de 8 dígitos para acceder.' })
            }
            return
        }

        // ---------- MENÚ PRINCIPAL ----------
        if (text === 'menu' || text === 'hola') {
            await sock.sendMessage(sender, { text: `👋 Bienvenido a la tienda\nEscribe *catalogo* para ver productos\nEscribe *carrito* para ver tu carrito\nEscribe *confirmar* para finalizar tu pedido\nEscribe *contactar* para hablar con un asesor` })
        }

        // ---------- MOSTRAR CATÁLOGO ----------
        if (text === 'catalogo') {
            for (let item of catalog) {
                await sock.sendMessage(sender, {
                    image: { url: item.imagen },
                    caption: `*${item.nombre}*\n💲 Precio: $${item.precio}\nID: ${item.id}\n${item.descripcion}\n\nPara agregar al carrito escribe: agregar ${item.id}`
                })
            }
        }

        // ---------- AGREGAR AL CARRITO ----------
        if (text.startsWith('agregar')) {
            const id = Number(text.split(' ')[1])
            const product = catalog.find(p => p.id === id)
            if (!product) {
                await sock.sendMessage(sender, { text: '❌ Producto no encontrado.' })
                return
            }

            if (!carts[sender]) carts[sender] = []
            carts[sender].push({ id: product.id, nombre: product.nombre, precio: product.precio })
            fs.writeFileSync('./carts.json', JSON.stringify(carts, null, 2))

            await sock.sendMessage(sender, { text: `✔ ${product.nombre} agregado a tu carrito.\nEscribe *carrito* para ver tu carrito.` })
        }

        // ---------- VER CARRITO ----------
        if (text === 'carrito') {
            const cart = carts[sender] || []
            if (cart.length === 0) {
                await sock.sendMessage(sender, { text: '🛒 Tu carrito está vacío.' })
                return
            }

            let msg = '🛒 *Tu carrito*:\n\n'
            let total = 0
            cart.forEach((p, i) => {
                msg += `${i+1}. ${p.nombre} - $${p.precio}\n`
                total += p.precio
            })
            msg += `\n💲 Total: $${total}\n\nEscribe *confirmar* para finalizar tu pedido o *vaciar* para borrar el carrito.`
            await sock.sendMessage(sender, { text: msg })
        }

        // ---------- CONFIRMAR PEDIDO ----------
        if (text === 'confirmar') {
            const cart = carts[sender] || []
            if (cart.length === 0) {
                await sock.sendMessage(sender, { text: '❌ Tu carrito está vacío.' })
                return
            }

            const order = { cliente: sender, productos: cart, fecha: new Date().toISOString() }
            orders.push(order)
            fs.writeFileSync('./orders.json', JSON.stringify(orders, null, 2))

            carts[sender] = []
            fs.writeFileSync('./carts.json', JSON.stringify(carts, null, 2))

            await sock.sendMessage(sender, { text: `✔ Pedido confirmado!\nUn asesor se pondrá en contacto contigo.` })
        }

        // ---------- VACIAR CARRITO ----------
        if (text === 'vaciar') {
            carts[sender] = []
            fs.writeFileSync('./carts.json', JSON.stringify(carts, null, 2))
            await sock.sendMessage(sender, { text: '🗑 Carrito vaciado.' })
        }

        // ---------- CONTACTAR ASESOR ----------
        if (text === 'contactar') {
            await sock.sendMessage(sender, { text: '💬 Un asesor te contactará pronto.' })
        }
    })
}

connectBot()