# `rconjs`

A simple RCON client written in TypeScript.

## Installation

```bash
npm install rconjs
```

## Usage

```ts
import RCONClient from 'rconjs';

const client = new RCONClient('localhost', 25575, 'password');

async function start() {
  try {
    await client.connect()
    await client.authorize()

    client.send('say Hello from rconjs!', (res) => {
      console.log(res)
    })
  } catch(e) {
    console.error(e)
  }
}

start()
```