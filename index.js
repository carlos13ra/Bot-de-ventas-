import makeWASocket from '@whiskeysockets/baileys'
import { fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import fs from 'fs'

// Datos
const codes = JSON.parse(fs.readFileSync('codes.json'))
const catalog = JSON.parse(fs.readFileSync('catalog.json'))
const orders = JSON.parse(fs.readFileSync('orders.json'))

let allowedUsers = []

// Función principal
async function startBot() {
  const { version } = await fetchLatestBaileysVersion()
  const sock = makeWASocket({ version, printQRInTerminal: true })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return

    const sender = m.key.remoteJid
    const text = (m.message.conversation || '').trim().toLowerCase()

    // Verificar acceso por código
    if (!allowedUsers.includes(sender)) {
      if (codes.includes(text)) {
        allowedUsers.push(sender)
        await sock.sendMessage(sender, { text: '✔ Código aceptado, ya puedes usar el bot. Escribe *menu* para empezar.' })
      } else {
        await sock.sendMessage(sender, { text: '❌ Ingresa tu código de 8 dígitos para acceder.' })
      }
      return
    }

    // Comandos principales
    if (text === 'menu') {
      await sock.sendMessage(sender, { text: '👋 Bienvenido a la tienda\nEscribe *catalogo* para ver productos\nEscribe *comprar <ID>* para comprar\nEscribe *contactar* para hablar con un asesor' })
    }

    if (text === 'catalogo') {
      for (let item of catalog) {
        await sock.sendMessage(sender, {
          image: { url: item.imagen },
          caption: `*${item.nombre}*\n💲 Precio: $${item.precio}\nID: ${item.id}\n${item.descripcion}`
        })
      }
    }

    if (text.startsWith('comprar')) {
      const id = Number(text.split(' ')[1])
      const product = catalog.find(p => p.id === id)
      if (!product) {
        await sock.sendMessage(sender, { text: '❌ Producto no encontrado.' })
        return
      }

      orders.push({ cliente: sender, producto: product.nombre, precio: product.precio, fecha: new Date().toISOString() })
      fs.writeFileSync('orders.json', JSON.stringify(orders, null, 2))

      await sock.sendMessage(sender, { text: `✔ Pedido registrado!\nProducto: ${product.nombre}\nPrecio: $${product.precio}\nUn asesor te contactará.` })
    }

    if (text === 'contactar') {
      await sock.sendMessage(sender, { text: '💬 Un asesor se pondrá en contacto contigo pronto.' })
    }
  })
}

startBot()
