// https://developer.valvesoftware.com/wiki/Source_RCON_Protocol

import { Socket } from 'node:net'

export const PacketType = {
  'SERVERDATA_AUTH': 3,
  'SERVERDATA_AUTH_RESPONSE': 3,
  'SERVERDATA_EXECCOMAND': 2,
  'SERVERDATA_RESPONSE_VALUE': 0
}

export type Packet = {
  type: number,
  id: number,
  body: string
}

export type PacketWithSize = Packet & { size: number }

/** Creates an RCON packet with the given data. */
export function createPacket({ type, id, body }: Packet) {

  const size = Buffer.byteLength(body)
    + (4 * 3) // size, type, id - each 4 bytes
    + 2       // String terminator + 8 empty bits

  if(size > 4096) {
    console.warn("Packet over 4096 bytes. Body will be truncated.")
  }

  const buffer = Buffer.alloc(size)

  buffer.writeInt32LE(size - 4, 0)
  buffer.writeInt32LE(id,       4)
  buffer.writeInt32LE(type,     8)

  buffer.write(
    body, 
    12, 
    size-2, //Make sure not write more than we specified. Last 8 bits must be 0b00000000
    "ascii"
  )

  // Write a null termination of the body, and the required 8 bits of 0s
  buffer.writeInt16LE(0, size - 2)

  return buffer
}

/** Reads a packet, assuming it is a valid RCON packet. */
export function readPacket(buffer: Buffer): PacketWithSize {
  return {
    size: buffer.readInt32LE(0),
    id:   buffer.readInt32LE(4),
    type: buffer.readInt32LE(8),
    body: buffer.toString("ascii", 12, buffer.length - 2)
  }
}


/** Describes an RCON client with functions to connect, authorize, and send packets */
export class RCONClient {
  private client: Socket

  connected = false
  authorized = false

  private authPacket: Packet | null = null
  private resolveAuthPromise: ((value: void | PromiseLike<void>) => void) | null = null
  private rejectAuthPromise: ((reason?: any) => void) | null = null

  private lastId = 0
  private callbacks = new Map<number, ((response: string) => void) | undefined>()

  constructor(private host: string, private port: number, private password: string) {
    this.client = new Socket()

    // Set up listener
    this.client.on('data', (buffer) => {
      const data = readPacket(buffer)

      switch(data.type) {

        case 2: {
          if(
            this.authPacket == null
            || this.authorized
            || this.resolveAuthPromise == null
            || this.rejectAuthPromise == null
          ) {
            console.warn('Received authorization packet after or before authorization')
            return
          }

          this.authorized = data.id === this.authPacket.id

          if(this.authorized) {
            this.resolveAuthPromise()
          } else {
            this.rejectAuthPromise()
          }

          this.authPacket = null
          this.resolveAuthPromise = null
          this.rejectAuthPromise = null
          
          break
        }

        case 0: {
          // Someday... https://developer.valvesoftware.com/wiki/Source_RCON_Protocol#Multiple-packet_Responses

          this.callbacks.get(data.id)?.(data.body)
          this.callbacks.delete(data.id)

          break
        }

        default: {
          console.log(`Invalid or unknown packet type received: ${data.type}`)
          break;
        }
      }
    })

    this.client.on('close', () => {
      console.log(`Connection to ${host}:${port} closed.`)
      this.connected = false
    })

  }

  async connect() {
    return new Promise<void>((resolve, reject) => {
      try {
        this.connected = true
        this.client.connect({host: this.host, port: this.port}, resolve)
      } catch(e) {
        reject(e)
      }
    })
  }

  async authorize() {
    return new Promise<void>((resolve, reject) => {

      this.resolveAuthPromise = resolve
      this.rejectAuthPromise = reject

      this.authPacket = {
        id: 123,
        type: PacketType['SERVERDATA_AUTH'],
        body: this.password
      }

      this.client.write(createPacket(this.authPacket))
    })
  }

  close() {
    this.client.destroy()
  }

  /** Send a command */
  send(command: string, callback?: (result: string) => void) {
    let id = ++this.lastId
    this.callbacks.set(id, callback)

    this.client.write(createPacket({
      id,
      type: PacketType['SERVERDATA_EXECCOMAND'],
      body: command
    }))
  }
}

export default RCONClient