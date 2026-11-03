'use strict'
// 零依赖 ZIP 打包器（store 模式不压缩——媒体文件本身已是压缩格式）
// 用法: buildZip([{ name: 'dir/file.jpg', data: Buffer }]) → Buffer

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function dosDateTime(d) {
  const y = d.getFullYear(), mo = d.getMonth() + 1, da = d.getDate()
  const h = d.getHours(), mi = d.getMinutes(), se = Math.floor(d.getSeconds() / 2)
  return {
    time: (h << 11) | (mi << 5) | se,
    date: ((Math.max(y, 1980) - 1980) << 9) | (mo << 5) | da
  }
}

function buildZip(entries) {
  const now = dosDateTime(new Date())
  const locals = [], centrals = []
  let offset = 0
  for (const ent of entries) {
    const nameBuf = Buffer.from(ent.name, 'utf8')
    const data = ent.data
    const crc = crc32(data)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)       // local file header sig
    lh.writeUInt16LE(20, 4)               // version needed
    lh.writeUInt16LE(0x0800, 6)           // flags: UTF-8 names
    lh.writeUInt16LE(0, 8)                // method: store
    lh.writeUInt16LE(now.time, 10)
    lh.writeUInt16LE(now.date, 12)
    lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(data.length, 18)     // compressed size
    lh.writeUInt32LE(data.length, 22)     // uncompressed size
    lh.writeUInt16LE(nameBuf.length, 26)
    lh.writeUInt16LE(0, 28)               // extra len
    locals.push(lh, nameBuf, data)

    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)       // central dir sig
    ch.writeUInt16LE(20, 4)               // version made by
    ch.writeUInt16LE(20, 6)               // version needed
    ch.writeUInt16LE(0x0800, 8)           // flags UTF-8
    ch.writeUInt16LE(0, 10)               // method store
    ch.writeUInt16LE(now.time, 12)
    ch.writeUInt16LE(now.date, 14)
    ch.writeUInt32LE(crc, 16)
    ch.writeUInt32LE(data.length, 20)
    ch.writeUInt32LE(data.length, 24)
    ch.writeUInt16LE(nameBuf.length, 28)
    ch.writeUInt16LE(0, 30)               // extra
    ch.writeUInt16LE(0, 32)               // comment
    ch.writeUInt16LE(0, 34)               // disk number
    ch.writeUInt16LE(0, 36)               // internal attrs
    ch.writeUInt32LE(0, 38)               // external attrs
    ch.writeUInt32LE(offset, 42)          // local header offset
    centrals.push(ch, nameBuf)
    offset += 30 + nameBuf.length + data.length
  }
  const centralSize = centrals.reduce((s, b) => s + b.length, 0)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralSize, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...locals, ...centrals, eocd])
}

module.exports = { buildZip }
