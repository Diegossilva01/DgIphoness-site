const peerRooms = new Map<string, string>()

function peerKey(peer: any) {
  return String(peer?.id || peer?.toString?.() || '')
}

function cleanRoom(value: unknown) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
}

export default defineWebSocketHandler({
  open(peer) {
    peer.send(JSON.stringify({ type: 'relay-ready' }))
  },

  message(peer, message) {
    let data: any
    try {
      data = JSON.parse(message.text())
    } catch {
      return
    }

    if (data?.type === 'ping') {
      peer.send(JSON.stringify({ type: 'pong', at: data.at || Date.now() }))
      return
    }

    const key = peerKey(peer)

    if (data?.type === 'relay-join') {
      const room = cleanRoom(data.room)
      if (!room) return

      const previous = peerRooms.get(key)
      if (previous && previous !== room) peer.unsubscribe(previous)

      peerRooms.set(key, room)
      peer.subscribe(room)
      peer.send(JSON.stringify({ type: 'relay-joined', room }))

      peer.publish(room, JSON.stringify({
        type: 'presence',
        event: 'joined',
        room,
        clientId: String(data.clientId || ''),
        role: data.role === 'host' ? 'host' : 'guest',
        at: Date.now()
      }))
      return
    }

    const room = cleanRoom(data?.room || peerRooms.get(key))
    if (!room || peerRooms.get(key) !== room) return

    // O relay não guarda a partida. Ele apenas retransmite os eventos da sala.
    // O Jogador 1 é a fonte autoritativa e repassa o estado completo após
    // cada jogada e também depois de qualquer reconexão.
    peer.publish(room, message.text())
  },

  close(peer) {
    const key = peerKey(peer)
    const room = peerRooms.get(key)
    if (!room) return
    peer.publish(room, JSON.stringify({
      type: 'presence',
      event: 'left',
      room,
      at: Date.now()
    }))
    peer.unsubscribe(room)
    peerRooms.delete(key)
  },

  error(peer, error) {
    console.error('[ludo-ws]', error)
  }
})
