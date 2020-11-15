import ws from "ws";
import fs from "fs";
import https from "https";
import { ctx } from "..";
import { NIL as NIL_UUID } from 'uuid';
import uuid from 'uuid-random';

import { DEDICATED_COMPRESSOR_3KB, SHARED_COMPRESSOR, SSLApp } from "uWebSockets.js";
import { Message } from "discord.js";

const enc = new TextDecoder("utf-8");
const ChannelIDRegex = /(id) (\w{16,20})/
const RegexIsMessage = /message/

const BotIPV6Adress = new Set<string>(['0000:0000:0000:0000:0000:ffff:3359:fca7'])
const SubscribeMap = new Map<string, string>();

SSLApp({
	cert_file_name: "/etc/letsencrypt/live/patrykstyla.com/fullchain.pem",
	key_file_name: "/etc/letsencrypt/live/patrykstyla.com/privkey.pem",
}).ws('/*', {
	idleTimeout: 30,
	maxBackpressure: 1024,
	maxPayloadLength: 512,
	compression: SHARED_COMPRESSOR,

	upgrade: (res, req, context) => {
		res.upgrade({
			url: req.getUrl()
		},
			req.getHeader('sec-websocket-key'),
			req.getHeader('sec-websocket-protocol'),
			req.getHeader('sec-websocket-extensions'),
			context
		)
	},
	open: (ws) => {
		if (BotIPV6Adress.has(enc.decode(ws.getRemoteAddressAsText()))) {
			console.log("Bot connected")
			// This client is our bot
			ws.bot = true;
		}
	},
	message: (ws, message, isBinary) => {
		const DecMessage = enc.decode(message);

		if (ws.bot) {
			if (RegexIsMessage.test(DecMessage)) {
				const JsonMessage = JSON.parse(DecMessage) as IBotMessage;
				ws.publish(JsonMessage.message.guild_id, message)
			}
		} else {
			const [, id, guild_id] = ChannelIDRegex.exec(DecMessage,) || ['', '', '']
			// INDEX 0: whole string, 1: 'id', 2: id string
			if (guild_id) {
				ws.subscribe(guild_id);
			}
		}


		// ws.send((ws as any).uuid)
		// console.log(`Message: ${enc.decode(message)}`);
	},
	drain: (ws) => {
		console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
	},
	close: (ws, code, message) => {
		console.log('WebSocket closed');
	},
}).listen(9001, (listenSocket) => {
	if (listenSocket) {
		console.log('Listening to port 9001');
	}
})
// export const server = https.createServer({
// 	cert: fs.readFileSync("/etc/letsencrypt/live/patrykstyla.com/fullchain.pem"),
// 	key: fs.readFileSync("/etc/letsencrypt/live/patrykstyla.com/privkey.pem"),
// });

// // const wss = new WebSocket.Server({ server ,path:"/ws"});
// const wss = new ws.Server({ server })


// wss.on("error", (error) => {
// 	console.log("Error", error);
// });

// wss.on("headers", (headers, request) => {

// })

// wss.on("close", () => {

// })

// wss.on("listening", () => {
// 	console.log("WS Server is ready");
// })

// function noop() { }

// wss.on("connection", (ws, request) => {

// 	(ws as any).isAlive = true;
// 	// const id = setInterval(function () {
// 	//     ws.send(JSON.stringify(process.memoryUsage()), function () {
// 	//         //
// 	//         // Ignore errors.
// 	//         //
// 	//     });
// 	// }, 100);
// 	ws.on("pong", (data) => {
// 		(ws as any).isAlive = true
// 	})

// 	ws.on("ping", (data) => {

// 	})

// 	const interval = setInterval(function ping() {
// 		wss.clients.forEach(function each(ws) {
// 			if ((ws as any).isAlive === false) {
// 				console.log(ctx.red(`Websocket terminated due to innactivity: ${ws}`))
// 				return ws.terminate();
// 			}
// 			(ws as any).isAlive = false;
// 			ws.ping(noop);
// 		});
// 	}, 30000);

// 	ws.on("error", (error) => {
// 		console.log(`WS server error: ${error}`)
// 	})
// 	ws.on("close", (a, b) => {
// 		console.log(`Client ${a} dissconnetced because ${b}`);
// 		// clearInterval(id);
// 		clearInterval(interval);
// 	});

// 	ws.on("message", (message) => {
// 		console.log("Server received: %s", message);
// 		wss.clients.forEach((client) => {
// 			if (client !== ws && client.readyState === ws.OPEN) {
// 				client.send(message);
// 			}
// 		});
// 	});
// });

// server.listen(8080);


interface IBotMessage {
	message: {
		id: string
		guild_id: string
		channel_id: string
		content: string
		author: string
	}
}